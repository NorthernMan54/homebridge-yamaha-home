const packageJson = require('../package.json');
const debug = require('debug')('yamaha-Party');

module.exports = class YamahaParty {
  constructor(externalContext, name, yamaha, sysConfig) {
    this.log = externalContext.log;
    this.config = externalContext.config;
    this.api = externalContext.api;
    this.accessories = externalContext.accessories;
    this.yamaha = yamaha;
    this.sysConfig = sysConfig;

    // Constructor parameters and their usage review
    this.nameSuffix = this.config['name_suffix'] || ' Party Mode'; // Used in logging name generation
    this.zone = this.config['zone'] || 1; // Used in UUID generation
    this.name = 'Party Mode'; // Used for accessory name
    this.serviceName = name; // Used for service initialization
    this.setMainInputTo = this.config['setMainInputTo']; // Used in `partyModeOn` logic
    // this.playVolume = this.config["play_volume"]; // Not used
    this.minVolume = this.config['min_volume'] || -65.0; // Not directly used here but useful for volume scaling logic
    this.maxVolume = this.config['max_volume'] || -10.0; // Not directly used here but useful for volume scaling logic
    this.gapVolume = this.maxVolume - this.minVolume; // Not directly used here but calculated for potential future usage
    // this.showInputName = this.config["show_input_name"] || "no"; // Not used

    this.log('Adding Party Switch %s', name);
    return this.getAccessory();
  }

  getAccessory() {
    const uuid = this.api.hap.uuid.generate(
      `${this.name}${this.sysConfig.YAMAHA_AV.System[0].Config[0].System_ID[0]}${this.zone}`,
    );
    let accessory;
    if (!this.accessories.find(accessory => accessory.UUID === uuid)) {
      this.log.info(`Creating YamahaParty accessory for ${this.name}`);
      accessory = new this.api.platformAccessory(this.name, uuid);
    } else {
      this.log.info(`Wiring YamahaParty accessory for ${this.name}`);
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
      .setCharacteristic(this.api.hap.Characteristic.Manufacturer, 'yamaha-home')
      .setCharacteristic(
        this.api.hap.Characteristic.Model,
        this.sysConfig.YAMAHA_AV.System[0].Config[0].Model_Name[0],
      )
      .setCharacteristic(this.api.hap.Characteristic.FirmwareRevision, packageJson.version)
      .setCharacteristic(
        this.api.hap.Characteristic.SerialNumber,
        this.sysConfig.YAMAHA_AV.System[0].Config[0].System_ID[0],
      );

    const partyService =
      accessory.getService(this.api.hap.Service.Switch) ||
      accessory.addService(this.api.hap.Service.Switch, this.name);

    partyService
      .getCharacteristic(this.api.hap.Characteristic.On)
      /*
      .onGet(async () => {
        try {
          return await this.yamaha.isPartyModeEnabled();
        } catch (error) {
          this.log.error('Error getting Party mode:', error);
        }
      })
      */
      .onSet(async (value) => {
        try {
          if (value) {
            await this.yamaha.powerOn();
            await this.yamaha.partyModeOn();
          } else {
            await this.yamaha.partyModeOff();
          }
        } catch (error) {
          this.log.error('Error setting Party mode:', error);
        }
      });

    accessory.context.updateStatus.push(this.getStatus);
    return [informationService, partyService];
  }


  async getStatus(accessory) {
    for (const service of accessory.services) {
      try {
        let value;
        switch (service.UUID) {
          case this.api.hap.Service.Switch.UUID:
            value = await accessory.context.yamaha.isPartyModeEnabled();
            service.getCharacteristic(this.api.hap.Characteristic.On).updateValue(value);
            debug('Status update Party Switch status to %s', value);
            break;
          case this.api.hap.Service.AccessoryInformation.UUID:
            break;
          default:
            debug('Unknown service type: %s', service.UUID);
            break;
        }
      } catch (error) {
        this.log.error(
          `Error getting status for ${(service.name ? service.name : service.displayName)}:`,
          error,
        );
      }
    }
  }
};
