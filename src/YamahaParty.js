const { Service, Characteristic } = require('homebridge'); // Adjust import paths as needed
const packageJson = require('../package.json');
var debug = require('debug')('yamaha-Zone');

module.exports = class YamahaParty {
  constructor(log, config, name, yamaha, sysConfig) {
    this.log = log;
    this.config = config;
    this.yamaha = yamaha;
    this.sysConfig = sysConfig;

    this.nameSuffix = config["name_suffix"] || " Party Mode";
    this.zone = config["zone"] || 1;
    this.name = "Party Mode";
    this.serviceName = name;
    this.setMainInputTo = config["setMainInputTo"];
    this.playVolume = config["play_volume"];
    this.minVolume = config["min_volume"] || -65.0;
    this.maxVolume = config["max_volume"] || -10.0;
    this.gapVolume = this.maxVolume - this.minVolume;
    this.showInputName = config["show_input_name"] || "no";

    log("Adding Party Switch %s", name);
  }

  getServices() {
    const informationService = new Service.AccessoryInformation();
    informationService
      .setCharacteristic(Characteristic.Name, this.name)
      .setCharacteristic(Characteristic.Manufacturer, "yamaha-home")
      .setCharacteristic(Characteristic.Model, this.sysConfig.YAMAHA_AV.System[0].Config[0].Model_Name[0])
      .setCharacteristic(Characteristic.FirmwareRevision, packageJson.version)
      .setCharacteristic(Characteristic.SerialNumber, this.sysConfig.YAMAHA_AV.System[0].Config[0].System_ID[0]);

    const partyService = new Service.Switch(this.name);
    partyService.getCharacteristic(Characteristic.On)
      .on('get', (callback) => {
        this.yamaha.isPartyModeEnabled()
          .then(result => callback(null, result))
          .catch(err => callback(err));
      })
      .on('set', (on, callback) => {
        if (on) {
          this.yamaha.powerOn()
            .then(() => this.yamaha.partyModeOn())
            .then(() => callback(null, true))
            .catch(err => callback(err));
        } else {
          this.yamaha.partyModeOff()
            .then(() => callback(null, false))
            .catch(err => callback(err));
        }
      });

    return [informationService, partyService];
  }
}
