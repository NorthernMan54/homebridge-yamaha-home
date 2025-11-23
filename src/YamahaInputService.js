const debug = require('debug')('yamaha-input');
const packageJson = require('../package.json');

class YamahaInputService {
  constructor(externalContext, name, yamaha, sysConfig) {
    this.config = externalContext.config;
    this.log = externalContext.log;
    this.api = externalContext.api;
    this.accessories = externalContext.accessories;
    this.yamaha = yamaha;
    this.sysConfig = sysConfig;

    this.zone = this.config["zone"] || 1; // Used in multiple methods
    this.name = name; // Used for accessory name and services
    this.setDefaultVolume = this.config["set_default_volume"]; // Used in onSet for volume configuration
    // this.serviceName = name; // Not used
    // this.defaultServiceName = this.config["default_service_name"]; // Not used
    this.setMainInputTo = this.config["setMainInputTo"]; // Used to set the input source
    // this.playVolume = this.config["play_volume"]; // Not used
    this.minVolume = this.config["min_volume"] || -65.0; // Used in getStatus for fan volume
    this.maxVolume = this.config["max_volume"] || -10.0; // Used in getStatus for fan volume
    this.gapVolume = this.maxVolume - this.minVolume; // Used in getStatus for volume percentage calculation
    // this.showInputName = this.config["show_input_name"] || "no"; // Not used
    this.setInputTo = this.config["setInputTo"] || this.setMainInputTo; // Used for setting input in onSet
    this.setScene = this.config["set_scene"] || {}; // Used in onSet for scene configuration

    this.log(`Adding Input Switch ${name}`);
    return this.getAccessory();
  }

  getAccessory() {
    const uuid = this.api.hap.uuid.generate(
      `${this.name}${this.sysConfig.YAMAHA_AV.System[0].Config[0].System_ID[0]}${this.zone}`
    );
    var accessory;
    if (!this.accessories.find(accessory => accessory.UUID === uuid)) {
      accessory = new this.api.platformAccessory(this.name, uuid);
    } else {
      accessory = this.accessories.find(accessory => accessory.UUID === uuid);
    }
    accessory.context = { yamaha: this.yamaha, zone: this.zone, updateStatus: [] };
    this.getServices(accessory);
    return accessory;
  }

  getServices(accessory) {
    const informationService =
      accessory.getService(this.api.hap.Service.AccessoryInformation) ||
      accessory.addService(this.api.hap.Service.AccessoryInformation);

    informationService
      .setCharacteristic(this.api.hap.Characteristic.Name, this.name)
      .setCharacteristic(this.api.hap.Characteristic.Manufacturer, "yamaha-home")
      .setCharacteristic(
        this.api.hap.Characteristic.Model,
        this.sysConfig.YAMAHA_AV.System[0].Config[0].Model_Name[0]
      )
      .setCharacteristic(this.api.hap.Characteristic.FirmwareRevision, packageJson.version)
      .setCharacteristic(
        this.api.hap.Characteristic.SerialNumber,
        this.sysConfig.YAMAHA_AV.System[0].Config[0].System_ID[0]
      );

    const inputSwitchService =
      accessory.getService(this.api.hap.Service.Switch) ||
      accessory.addService(this.api.hap.Service.Switch, this.name);

    inputSwitchService
      .getCharacteristic(this.api.hap.Characteristic.On)
      /*
      .onGet(async () => {
        try {
          return this.name.includes((await this.yamaha.isOn() ? await this.yamaha.getCurrentInput() : 'false'));
        } catch (error) {
          this.log.error('Error getting Input:', error);
        }
      })
      */
      .onSet(async (on) => {
        if (on) {
          debug('Setting Input', this.setInputTo);
          await this.yamaha.powerOn();
          await this.yamaha.setMainInputTo(this.setInputTo);

          if (this.setScene) {
            await this.yamaha.SendXMLToReceiver(
              `<YAMAHA_AV cmd="PUT"><Main_Zone><Scene><Scene_Sel>Scene ${this.setScene}</Scene_Sel></Scene></Main_Zone></YAMAHA_AV>`
            );
          }

          if (this.setDefaultVolume) {
            await this.yamaha.setVolumeTo(this.setDefaultVolume * 10, this.zone);
          }
        }
      });
    accessory.context.updateStatus.push(this.getStatus);
    return [informationService, inputSwitchService];
  }

  async getStatus(accessory) {
    for (const service of accessory.services) {
      try {
        let value;
        switch (service.UUID) {
          case this.api.hap.Service.Switch.UUID:
            value = (await accessory.context.yamaha.isOn() ? await accessory.context.yamaha.getCurrentInput() : 'false');
            // value = await accessory.context.yamaha.getCurrentInput();
            // console.log('Input', value, service.displayName, service.displayName.includes(value));
            service.getCharacteristic(this.api.hap.Characteristic.On).updateValue(service.displayName.includes(value));
            debug('Status update %s Switch service %s to %s', service.displayName, accessory.context.zone, service.displayName.includes(value));
            break;

          case this.api.hap.Service.Fan.UUID: {
            value = await accessory.context.yamaha.isOn(accessory.context.zone);
            service.updateCharacteristic(this.api.hap.Characteristic.On, value);

            const basicInfo = await accessory.context.yamaha.getBasicInfo(accessory.context.zone);
            const volume = await basicInfo.getVolume() / 10.0;
            let percentage = 100 * ((volume - this.minVolume) / this.gapVolume);
            percentage = Math.max(0, Math.min(100, Math.round(percentage)));
            service.getCharacteristic(this.api.hap.Characteristic.RotationSpeed).updateValue(percentage);
            debug(
              'Status update Fan service %s On to %s, and Volume to %s',
              accessory.context.zone,
              value,
              percentage
            );
            break;
          }
          case this.api.hap.Service.AccessoryInformation.UUID:
            break;
          default:
            debug('Unknown service type: %s', service.UUID);
            break;
        }
      } catch (error) {
        this.log.error(
          `Error getting status for ${(service.name ? service.name : service.displayName)}:`,
          error
        );
      }
    }
  }
}

module.exports = YamahaInputService;
