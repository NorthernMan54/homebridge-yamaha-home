



module.exports = class YamahaZone {
  
  constructor(log, config, name, yamaha, sysConfig, zone) {
    this.log = log;
    this.config = config;
    this.yamaha = yamaha;
    this.sysConfig = sysConfig;

    this.minVolume = config["min_volume"] || -65.0;
    this.maxVolume = config["max_volume"] || -10.0;
    this.gapVolume = this.maxVolume - this.minVolume;

    this.zone = zone;
    this.zoneNameMap = config["zone_name_map"] || {};
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

  getServices() {
    var that = this;
    var informationService = new Service.AccessoryInformation();
    var yamaha = this.yamaha;

    informationService
      .setCharacteristic(Characteristic.Name, this.name)
      .setCharacteristic(Characteristic.Manufacturer, "yamaha-home")
      .setCharacteristic(Characteristic.Model, this.sysConfig.YAMAHA_AV.System[0].Config[0].Model_Name[0])
      .setCharacteristic(Characteristic.FirmwareRevision, require('../package.json').version)
      .setCharacteristic(Characteristic.SerialNumber, this.sysConfig.YAMAHA_AV.System[0].Config[0].System_ID[0]);

    if (this.zone === "Main_Zone") {
      var mainPower = new Service.Switch("Yamaha Power");
      mainPower.getCharacteristic(Characteristic.On)
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

    var zoneService = new Service.Fan(this.name);
    zoneService.getCharacteristic(Characteristic.On)
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

    zoneService.addCharacteristic(new Characteristic.RotationSpeed())
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
    if (mainPower) {
      return [informationService, zoneService, mainPower];
    } else {
      return [informationService, zoneService];
    }
  }
};
