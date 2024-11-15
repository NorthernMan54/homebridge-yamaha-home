// Description: This file contains the YamahaSwitch class which is responsible for creating the switch accessory for each preset.

class YamahaSwitch {
  constructor(externalContext, name, yamaha, sysConfig, preset) {
    this.log = externalContext.log;
    this.config = externalContext.config;
    this.api = externalContext.api;
    this.yamaha = yamaha;
    this.sysConfig = sysConfig;

    this.nameSuffix = this.config["name_suffix"] || " Speakers";
    this.zone = this.config["zone"] || 1;
    this.name = `Preset ${parseInt(name).toString()}`;
    this.serviceName = name + this.nameSuffix;
    this.setMainInputTo = this.config["setMainInputTo"];
    this.playVolume = this.config["play_volume"];
    this.minVolume = this.config["min_volume"] || -65.0;
    this.maxVolume = this.config["max_volume"] || -10.0;
    this.gapVolume = this.maxVolume - this.minVolume;
    this.showInputName = this.config["show_input_name"] || "no";
    this.preset = preset;

    return this.getAccessory();
  }

  getAccessory() {
    this.log(
      "Creating HomeKit accessory for ",
      `${this.name}${this.sysConfig.YAMAHA_AV.System[0].Config[0].System_ID[0]}${this.zone}`
    );
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
      .setCharacteristic(
        this.api.hap.Characteristic.FirmwareRevision,
        require('../package.json').version
      )
      .setCharacteristic(
        this.api.hap.Characteristic.SerialNumber,
        this.sysConfig.YAMAHA_AV.System[0].Config[0].System_ID[0]
      );

    const switchService =
      accessory.getService(this.api.hap.Service.Switch) ||
      accessory.addService(this.api.hap.Service.Switch, this.name);

    switchService
      .getCharacteristic(this.api.hap.Characteristic.On)
      .on('set', async (powerOn, callback) => {
        if (powerOn) {
          try {
            await this.yamaha.setMainInputTo("TUNER");
            await this.yamaha.selectTunerPreset(this.preset);
            this.log(`Tuning radio to preset ${this.preset} - ${this.name}`);

            // Automatically turn off the switch after 5 seconds
            setTimeout(() => {
              switchService.setCharacteristic(this.api.hap.Characteristic.On, 0);
            }, 5 * 1000);

            callback(null);
          } catch (error) {
            this.log('Error setting Yamaha switch:', error);
            callback(error);
          }
        } else {
          callback(null);
        }
      });

    return accessory;
  }
}

module.exports = YamahaSwitch;
