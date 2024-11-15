const packageJson = require('../package.json');
var debug = require('debug')('yamaha-Party');

module.exports = class YamahaParty {
  constructor(externalContext, name, yamaha, sysConfig) {
    this.log = externalContext.log;
    this.config = externalContext.config;
    this.api = externalContext.api;
    this.yamaha = yamaha;
    this.sysConfig = sysConfig;

    this.nameSuffix = this.config["name_suffix"] || " Party Mode";
    this.zone = this.config["zone"] || 1;
    this.name = "Party Mode";
    this.serviceName = name;
    this.setMainInputTo = this.config["setMainInputTo"];
    this.playVolume = this.config["play_volume"];
    this.minVolume = this.config["min_volume"] || -65.0;
    this.maxVolume = this.config["max_volume"] || -10.0;
    this.gapVolume = this.maxVolume - this.minVolume;
    this.showInputName = this.config["show_input_name"] || "no";

    this.log("Adding Party Switch %s", name);
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
      .setCharacteristic(this.api.hap.Characteristic.Model, this.sysConfig.YAMAHA_AV.System[0].Config[0].Model_Name[0])
      .setCharacteristic(this.api.hap.Characteristic.FirmwareRevision, packageJson.version)
      .setCharacteristic(this.api.hap.Characteristic.SerialNumber, this.sysConfig.YAMAHA_AV.System[0].Config[0].System_ID[0]);

    const partyService = accessory.getService(this.api.hap.Service.Switch) ||
    accessory.addService(this.api.hap.Service.Switch, this.name);
    partyService.getCharacteristic(this.api.hap.Characteristic.On)
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
