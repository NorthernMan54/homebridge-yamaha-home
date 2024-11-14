



module.exports = class YamahaZone {

  constructor(externalContext, name, yamaha, sysConfig, zone) {
    this.externalContext = externalContext;
    this.yamaha = yamaha;
    this.sysConfig = sysConfig;

    this.log = this.externalContext.log;
    this.api = this.externalContext.api;

    this.minVolume = this.externalContext.config["min_volume"] || -65.0;
    this.maxVolume = this.externalContext.config["max_volume"] || -10.0;
    this.gapVolume = this.maxVolume - this.minVolume;

    this.zone = zone;
    this.zoneNameMap = this.externalContext.config["zone_name_map"] || {};
    this.name = this.zoneNameMap[name] || name;
  }

  setPlaying(playing) {
    var that = this;
    var yamaha = this.yamaha;

    if (playing) {
      return yamaha.powerOn(that.zone).then(function () {
        if (that.playVolume) return yamaha.setVolumeTo(that.playVolume * 10, that.zone);
        else return Q();
      }).then(function () {
        if (that.setMainInputTo) return yamaha.setMainInputTo(that.setMainInputTo);
        else return Q();
      }).then(function () {
        if (that.setMainInputTo === "AirPlay") {
          return yamaha.SendXMLToReceiver(
            '<YAMAHA_AV cmd="PUT"><AirPlay><Play_Control><Playback>Play</Playback></Play_Control></AirPlay></YAMAHA_AV>'
          );
        } else return Q();
      });
    } else {
      return yamaha.powerOff(that.zone);
    }
  }

  /**
   * Return a fully configured Accessory
   */
  getAccessory() {
    this.log("Getting accessory for ", this.name + this.sysConfig.YAMAHA_AV.System[0].Config[0].System_ID[0] + this.zone);
    const uuid = this.api.hap.uuid.generate(this.name + this.sysConfig.YAMAHA_AV.System[0].Config[0].System_ID[0] + this.zone);
    var accessory = new this.api.platformAccessory(this.name, uuid);
    accessory.addService(this.getServices(accessory));
    return accessory;
  }

  getServices(accessory) {
    var informationService = accessory.getService(this.api.hap.Service.AccessoryInformation) ||
      accessory.addService(this.api.hap.Service.AccessoryInformation);

    // console.log('informationService', informationService);
    informationService
      .setCharacteristic(this.api.hap.Characteristic.Name, this.name)
      .setCharacteristic(this.api.hap.Characteristic.Manufacturer, "yamaha-home")
      .setCharacteristic(this.api.hap.Characteristic.Model, this.sysConfig.YAMAHA_AV.System[0].Config[0].Model_Name[0])
      .setCharacteristic(this.api.hap.Characteristic.FirmwareRevision, require('../package.json').version)
      .setCharacteristic(this.api.hap.Characteristic.SerialNumber, this.sysConfig.YAMAHA_AV.System[0].Config[0].System_ID[0]);

    if (this.zone === "Main_Zone") {
      var mainPower = accessory.getService(this.api.hap.Service.Switch) ||
        accessory.addService(this.api.hap.Service.Switch, "Yamaha Power");

      mainPower.getCharacteristic(this.api.hap.Characteristic.On)
        .on('get', function (callback, context) {
          yamaha.isOn().then(
            function (result) {
              callback(null, result);
            },
            function (error) {
              callback(error, false);
            }
          );
        })
        .on('set', function (powerOn, callback) {
          this.setPlaying(powerOn).then(function () {
            callback(null);
          }, function (error) {
            callback(error); // TODO: Actually determine and send real new status.
          });
        }.bind(this));
    }

    var zoneService = accessory.getService(this.api.hap.Service.Fan) ||
      accessory.addService(this.api.hap.Service.Fan, this.name);
    zoneService.getCharacteristic(this.api.hap.Characteristic.On)
      .on('get', function (callback, context) {
        yamaha.isOn(that.zone).then(
          function (result) {
            callback(null, result);
          },
          function (error) {
            callback(error, false);
          }
        );
      })
      .on('set', function (powerOn, callback) {
        this.setPlaying(powerOn).then(function () {
          callback(null);
        }, function (error) {
          callback(error); // TODO: Actually determine and send real new status.
        });
      }.bind(this));


    var volume = zoneService.getCharacteristic(this.api.hap.Characteristic.RotationSpeed) ||
      zoneService.addCharacteristic(this.api.hap.Characteristic.RotationSpeed);

    volume
      .on('get', function (callback, context) {
        yamaha.getBasicInfo(that.zone).then(function (basicInfo) {
          var v = basicInfo.getVolume() / 10.0;
          var p = 100 * ((v - that.minVolume) / that.gapVolume);
          p = p < 0 ? 0 : p > 100 ? 100 : Math.round(p);
          debug("Got volume percent of " + v + "%, " + p + "% ", that.zone);
          callback(null, p);
        }, function (error) {
          callback(error, 0);
        });
      })
      .on('set', function (p, callback) {
        var v = ((p / 100) * that.gapVolume) + that.minVolume;
        v = Math.round(v) * 10.0;
        debug("Setting volume to " + v + "%, " + p + "% ", that.zone);
        yamaha.setVolumeTo(v, that.zone).then(function (response) {
          debug("Success", response);
          callback(null);
        }, function (error) {
          callback(error);
        });
      });
    return (accessory);
  }
};
