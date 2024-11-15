const { Service, Characteristic } = require('hap-nodejs'); // Adjust imports as needed

class YamahaSwitch {
  constructor(log, config, name, yamaha, sysConfig, preset) {
    this.log = log;
    this.config = config;
    this.yamaha = yamaha;
    this.sysConfig = sysConfig;

    this.nameSuffix = config["name_suffix"] || " Speakers";
    this.zone = config["zone"] || 1;
    this.name = `Preset ${parseInt(name).toString()}`;
    this.serviceName = name + this.nameSuffix;
    this.setMainInputTo = config["setMainInputTo"];
    this.playVolume = config["play_volume"];
    this.minVolume = config["min_volume"] || -65.0;
    this.maxVolume = config["max_volume"] || -10.0;
    this.gapVolume = this.maxVolume - this.minVolume;
    this.showInputName = config["show_input_name"] || "no";
    this.preset = preset;
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

    const switchService = new Service.Switch(this.name);

    switchService
      .getCharacteristic(Characteristic.On)
      .on('set', async (powerOn, callback) => {
        if (powerOn) {
          try {
            await this.yamaha.setMainInputTo("TUNER");
            await this.yamaha.selectTunerPreset(this.preset);
            this.log(`Tuning radio to preset ${this.preset} - ${this.name}`);

            // Automatically turn off the switch after 5 seconds
            setTimeout(() => {
              switchService.setCharacteristic(Characteristic.On, 0);
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

    return [informationService, switchService];
  }
}

module.exports = YamahaSwitch;
