const debug = require('debug')('yamaha-input');
const packageJson = require('../package.json');

class YamahaInputService {
  constructor(externalContext, name, yamaha, sysConfig) {
    this.log = externalContext.log;
    this.config = externalContext.config;
    this.api = externalContext.api;
    this.yamaha = yamaha;
    this.sysConfig = sysConfig;

    this.nameSuffix = this.config["name_suffix"] || " Party Mode";
    this.zone = this.config["zone"] || 1;
    this.name = name;
    this.setDefaultVolume = this.config["set_default_volume"];
    this.serviceName = name;
    this.defaultServiceName = this.config["default_service_name"];
    this.setMainInputTo = this.config["setMainInputTo"];
    this.playVolume = this.config["play_volume"];
    this.minVolume = this.config["min_volume"] || -65.0;
    this.maxVolume = this.config["max_volume"] || -10.0;
    this.gapVolume = this.maxVolume - this.minVolume;
    this.showInputName = this.config["show_input_name"] || "no";
    this.setInputTo = this.config["setInputTo"] || this.setMainInputTo;
    this.setScene = this.config["set_scene"] || {}; // Scene Feature

    this.log(`Adding Input Switch ${name}`);
    return this.getAccessory();
  }

  getAccessory() {
    const uuid = this.api.hap.uuid.generate(
      `${this.name}${this.sysConfig.YAMAHA_AV.System[0].Config[0].System_ID[0]}${this.zone}`
    );
    const accessory = new this.api.platformAccessory(this.name, uuid);
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
      .on('get', async (callback) => {
        try {
          const result = await this.yamaha.getCurrentInput();
          debug(`Current Input: ${result}, Button Input: ${this.setInputTo}`);
          callback(null, result === this.setInputTo);
        } catch (error) {
          debug('Error getting input:', error);
          callback(error);
        }
      })
      .on('set', async (on, callback) => {
        if (on) {
          try {
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

            callback(null);
          } catch (error) {
            debug('Error setting input:', error);
            callback(error);
          }
        } else {
          callback(null);
        }

        setTimeout(() => {
          inputSwitchService.setCharacteristic(this.api.hap.Characteristic.On, 0);
        }, 5 * 1000);
      });

    return [informationService, inputSwitchService];
  }
}

module.exports = YamahaInputService;
