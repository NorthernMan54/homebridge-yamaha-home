const debug = require('debug')('yamaha-input');
const { Service, Characteristic } = require('hap-nodejs'); // Ensure correct imports based on your environment

class YamahaInputService {
  constructor(log, config, name, yamaha, sysConfig) {
    this.log = log;
    this.config = config;
    this.yamaha = yamaha;
    this.sysConfig = sysConfig;

    this.nameSuffix = config["name_suffix"] || " Party Mode";
    this.zone = config["zone"] || 1;
    this.name = name;
    this.setDefaultVolume = config["set_default_volume"];
    this.serviceName = name;
    this.defaultServiceName = config["default_service_name"];
    this.setMainInputTo = config["setMainInputTo"];
    this.playVolume = config["play_volume"];
    this.minVolume = config["min_volume"] || -65.0;
    this.maxVolume = config["max_volume"] || -10.0;
    this.gapVolume = this.maxVolume - this.minVolume;
    this.showInputName = config["show_input_name"] || "no";
    this.setInputTo = config["setInputTo"] || this.setMainInputTo;
    this.setScene = config["set_scene"] || {}; // Scene Feature

    this.log(`Adding Input Switch ${name}`);
  }

  getServices() {
    const informationService = new Service.AccessoryInformation();

    informationService
      .setCharacteristic(Characteristic.Name, this.name)
      .setCharacteristic(Characteristic.Manufacturer, "yamaha-home")
      .setCharacteristic(
        Characteristic.Model,
        this.sysConfig.YAMAHA_AV.System[0].Config[0].Model_Name[0]
      )
      .setCharacteristic(
        Characteristic.FirmwareRevision,
        require('../package.json').version
      )
      .setCharacteristic(
        Characteristic.SerialNumber,
        this.sysConfig.YAMAHA_AV.System[0].Config[0].System_ID[0]
      );

    const inputSwitchService = new Service.Switch(this.name);
    this.inputSwitchService = inputSwitchService;

    inputSwitchService
      .getCharacteristic(Characteristic.On)
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
          inputSwitchService.setCharacteristic(Characteristic.On, 0);
        }, 5 * 1000);
      });

    return [informationService, inputSwitchService];
  }
}

module.exports = YamahaInputService;
