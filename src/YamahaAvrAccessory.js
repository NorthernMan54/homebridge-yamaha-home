const packageJson = require('../package.json');


class YamahaAVRAccessory {
  constructor(externalContext, name, yamaha, sysConfig) {
    this.log = externalContext.log;
    this.config = externalContext.config;
    this.api = externalContext.api;
    this.yamaha = yamaha;
    this.sysConfig = sysConfig;

    this.nameSuffix = this.config["name_suffix"] || " Speakers";
    this.zone = this.config["zone"] || 1;
    this.name = name;
    this.serviceName = name + this.nameSuffix;
    this.setMainInputTo = this.config["setMainInputTo"];
    this.playVolume = this.config["play_volume"];
    this.minVolume = this.config["min_volume"] || -65.0;
    this.maxVolume = this.config["max_volume"] || -10.0;
    this.gapVolume = this.maxVolume - this.minVolume;
    this.showInputName = this.config["show_input_name"] || "no";
    return this.getAccessory();
  }

  async setPlaying(playing) {
    try {
      if (playing) {
        await this.yamaha.powerOn("System");

        if (this.playVolume) {
          await this.yamaha.setVolumeTo(this.playVolume * 10, this.zone);
        }

        if (this.setMainInputTo) {
          await this.yamaha.setMainInputTo(this.setMainInputTo);

          if (this.setMainInputTo === "AirPlay") {
            await this.yamaha.SendXMLToReceiver(
              '<YAMAHA_AV cmd="PUT"><AirPlay><Play_Control><Playback>Play</Playback></Play_Control></AirPlay></YAMAHA_AV>'
            );
          }
        }
      } else {
        await this.yamaha.powerOff("System");
      }
    } catch (error) {
      this.log.error("Error setting playing state:", error);
      throw error;
    }
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

    const switchService = accessory.getService(this.api.hap.Service.Switch) ||
      accessory.addService(this.api.hap.Service.Switch, "Yamaha Power");

    switchService
      .getCharacteristic(this.api.hap.Characteristic.On)
      .on("get", async (callback) => {
        try {
          const result = await this.yamaha.isOn();
          callback(null, result);
        } catch (error) {
          callback(error, false);
        }
      })
      .on("set", async (powerOn, callback) => {
        try {
          await this.setPlaying(powerOn);
          callback(null);
        } catch (error) {
          callback(error);
        }
      });

    const mainService = accessory.getService(this.api.hap.Service.Fan) ||
      accessory.addService(this.api.hap.Service.Fan, this.name);

    mainService
      .getCharacteristic(this.api.hap.Characteristic.On)
      .on("get", async (callback) => {
        try {
          const result = await this.yamaha.isOn();
          callback(null, result);
        } catch (error) {
          callback(error, false);
        }
      })
      .on("set", async (powerOn, callback) => {
        try {
          await this.setPlaying(powerOn);
          callback(null);
        } catch (error) {
          callback(error);
        }
      });

    const volume =
      mainService.getCharacteristic(this.api.hap.Characteristic.RotationSpeed) ||
      mainService.addCharacteristic(this.api.hap.Characteristic.RotationSpeed);
    volume
      .on("get", async (callback) => {
        try {
          const basicInfo = await this.yamaha.getBasicInfo(this.zone);
          const v = basicInfo.getVolume() / 10.0;
          const p = Math.min(100, Math.max(0, Math.round(100 * ((v - this.minVolume) / this.gapVolume))));
          callback(null, p);
        } catch (error) {
          callback(error, 0);
        }
      })
      .on("set", async (p, callback) => {
        try {
          const v = Math.round(((p / 100) * this.gapVolume) + this.minVolume) * 10.0;
          await this.yamaha.setVolumeTo(v, this.zone);
          callback(null);
        } catch (error) {
          callback(error);
        }
      });

    const audioDeviceService =
      accessory.getService(this.api.hap.Service.Speaker) ||
      accessory.addService(this.api.hap.Service.Speaker, "Speaker");

    const volCx = audioDeviceService.addCharacteristic(this.api.hap.Characteristic.Volume);

    volCx
      .on("get", async (callback) => {
        try {
          const basicInfo = await this.yamaha.getBasicInfo(this.zone);
          const v = basicInfo.getVolume() / 10.0;
          const p = Math.min(100, Math.max(0, Math.round(100 * ((v - this.minVolume) / this.gapVolume))));
          callback(null, p);
        } catch (error) {
          callback(error, 0);
        }
      })
      .on("set", async (p, callback) => {
        try {
          const v = Math.round(((p / 100) * this.gapVolume) + this.minVolume) * 10.0;
          await this.yamaha.setVolumeTo(v, this.zone);
          callback(null);
        } catch (error) {
          callback(error);
        }
      });

    const mutingCx = audioDeviceService.getCharacteristic(this.api.hap.Characteristic.Mute);
    mutingCx
      .on("get", async (callback) => {
        try {
          const basicInfo = await this.yamaha.getBasicInfo(this.zone);
          callback(null, basicInfo.isMuted());
        } catch (error) {
          callback(error, 0);
        }
      })
      .on("set", async (v, callback) => {
        try {
          const zoneName = this.zone !== 1 ? `Zone_${this.zone}` : "Main_Zone";
          const muteXML = `<YAMAHA_AV cmd="PUT"><${zoneName}><Volume><Mute>${v ? "On" : "Off"}</Mute></Volume></${zoneName}></YAMAHA_AV>`;
          await this.yamaha.SendXMLToReceiver(muteXML);
          callback(null);
        } catch (error) {
          callback(error);
        }
      });



    return [informationService, switchService, audioDeviceService, mainService];
  }
}

module.exports = YamahaAVRAccessory;