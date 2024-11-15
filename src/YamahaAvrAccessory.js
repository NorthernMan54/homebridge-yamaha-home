class YamahaAVRAccessory {
  constructor(log, config, name, yamaha, sysConfig) {
    this.log = log;
    this.config = config;
    this.yamaha = yamaha;
    this.sysConfig = sysConfig;

    this.nameSuffix = config["name_suffix"] || " Speakers";
    this.zone = config["zone"] || 1;
    this.name = name;
    this.serviceName = name + this.nameSuffix;
    this.setMainInputTo = config["setMainInputTo"];
    this.playVolume = this.config["play_volume"];
    this.minVolume = config["min_volume"] || -65.0;
    this.maxVolume = config["max_volume"] || -10.0;
    this.gapVolume = this.maxVolume - this.minVolume;
    this.showInputName = config["show_input_name"] || "no";
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

  getServices() {
    const that = this;

    const informationService = new Service.AccessoryInformation()
      .setCharacteristic(Characteristic.Name, this.name)
      .setCharacteristic(Characteristic.Manufacturer, "yamaha-home")
      .setCharacteristic(
        Characteristic.Model,
        this.sysConfig.YAMAHA_AV.System[0].Config[0].Model_Name[0]
      )
      .setCharacteristic(Characteristic.FirmwareRevision, require("../package.json").version)
      .setCharacteristic(
        Characteristic.SerialNumber,
        this.sysConfig.YAMAHA_AV.System[0].Config[0].System_ID[0]
      );

    const switchService = new Service.Switch("Yamaha Power");
    switchService
      .getCharacteristic(Characteristic.On)
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

    const mainService = new Service.Fan(this.name);
    mainService
      .getCharacteristic(Characteristic.On)
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

    mainService
      .addCharacteristic(new Characteristic.RotationSpeed())
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

    const audioDeviceService = new Service.Speaker("Speaker");
    const volCx = audioDeviceService.addCharacteristic(Characteristic.Volume);

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

    const mutingCx = audioDeviceService.getCharacteristic(Characteristic.Mute);
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

    const inputService = new YamahaAVRPlatform.InputService("Input Functions");
    inputService
      .getCharacteristic(YamahaAVRPlatform.Input)
      .on("get", async (callback) => {
        try {
          const basicInfo = await this.yamaha.getBasicInfo();
          callback(null, basicInfo.getCurrentInput());
        } catch (error) {
          callback(error, 0);
        }
      });

    if (this.showInputName === "yes") {
      const nameCx = inputService.addCharacteristic(YamahaAVRPlatform.InputName);
      nameCx
        .on("get", async (callback) => {
          try {
            const basicInfo = await this.yamaha.getBasicInfo();
            const name = basicInfo.YAMAHA_AV.Main_Zone[0].Basic_Status[0].Input[0].Input_Sel_Item_Info[0].Src_Name[0].replace("Osdname:", "");
            callback(null, name);
          } catch (error) {
            callback(error, 0);
          }
        });
    }

    return [informationService, switchService, audioDeviceService, inputService, mainService];
  }
}
