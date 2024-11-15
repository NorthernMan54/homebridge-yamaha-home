const debug = require('debug')('yamaha-Zone');
const packageJson = require('../package.json');

class YamahaZone {
  constructor(externalContext, name, yamaha, sysConfig, zone) {
    this.config = externalContext.config;
    this.accessories = externalContext.accessories;
    this.api = externalContext.api;
    this.log = externalContext.log;
    this.externalContext = externalContext;
    this.yamaha = yamaha;
    this.sysConfig = sysConfig;

    this.minVolume = this.config["min_volume"] || -65.0;
    this.maxVolume = this.config["max_volume"] || -10.0;
    this.gapVolume = this.maxVolume - this.minVolume;

    this.zone = zone;
    this.zoneNameMap = this.config["zone_name_map"] || {};
    this.name = this.zoneNameMap[name] || name;

    return this.getAccessory();
  }

  async setPlaying(playing) {
    try {
      if (playing) {
        await this.yamaha.powerOn(this.zone);

        if (this.playVolume) {
          await this.yamaha.setVolumeTo(this.playVolume * 10, this.zone);
        }

        if (this.setMainInputTo) {
          await this.yamaha.setMainInputTo(this.setMainInputTo);
        }

        if (this.setMainInputTo === "AirPlay") {
          await this.yamaha.SendXMLToReceiver(
            '<YAMAHA_AV cmd="PUT"><AirPlay><Play_Control><Playback>Play</Playback></Play_Control></AirPlay></YAMAHA_AV>'
          );
        }
      } else {
        await this.yamaha.powerOff(this.zone);
      }
    } catch (error) {
      debug('Error in setPlaying:', error);
      throw error;
    }
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

    if (this.zone === "Main_Zone") {
      const mainPower =
        accessory.getService(this.api.hap.Service.Switch) ||
        accessory.addService(this.api.hap.Service.Switch, "Yamaha Power");

      mainPower
        .getCharacteristic(this.api.hap.Characteristic.On)
        .on('get', async (callback) => {
          try {
            const result = await this.yamaha.isOn();
            callback(null, result);
          } catch (error) {
            callback(error, false);
          }
        })
        .on('set', async (powerOn, callback) => {
          try {
            await this.setPlaying(powerOn);
            callback(null);
          } catch (error) {
            callback(error);
          }
        });
    }

    const zoneService =
      accessory.getService(this.api.hap.Service.Fan) ||
      accessory.addService(this.api.hap.Service.Fan, this.name);

    zoneService
      .getCharacteristic(this.api.hap.Characteristic.On)
      .on('get', async (callback) => {
        try {
          const result = await this.yamaha.isOn(this.zone);
          callback(null, result);
        } catch (error) {
          callback(error, false);
        }
      })
      .on('set', async (powerOn, callback) => {
        try {
          await this.setPlaying(powerOn);
          callback(null);
        } catch (error) {
          callback(error);
        }
      });

    const volume =
      zoneService.getCharacteristic(this.api.hap.Characteristic.RotationSpeed) ||
      zoneService.addCharacteristic(this.api.hap.Characteristic.RotationSpeed);

    volume
      .on('get', async (callback) => {
        try {
          const basicInfo = await this.yamaha.getBasicInfo(this.zone);
          const v = basicInfo.getVolume() / 10.0;
          let p = 100 * ((v - this.minVolume) / this.gapVolume);
          p = Math.max(0, Math.min(100, Math.round(p)));
          debug(`Got volume percent of ${v}%, ${p}%`, this.zone);
          callback(null, p);
        } catch (error) {
          callback(error, 0);
        }
      })
      .on('set', async (p, callback) => {
        try {
          const v = Math.round(((p / 100) * this.gapVolume) + this.minVolume) * 10.0;
          debug(`Setting volume to ${v}%, ${p}%`, this.zone);
          await this.yamaha.setVolumeTo(v, this.zone);
          callback(null);
        } catch (error) {
          callback(error);
        }
      });
    return accessory;
  }
}

module.exports = YamahaZone;
