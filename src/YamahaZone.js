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

    this.minVolume = this.config['min_volume'] || -65.0;
    this.maxVolume = this.config['max_volume'] || -10.0;
    this.gapVolume = this.maxVolume - this.minVolume;

    this.zone = zone;
    this.zoneNameMap = this.config['zone_name_map'] || {};
    this.name = this.zoneNameMap[name] || name;

    this.statusList = [];
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

        if (this.setMainInputTo === 'AirPlay') {
          await this.yamaha.SendXMLToReceiver(
            '<YAMAHA_AV cmd="PUT"><AirPlay><Play_Control><Playback>Play</Playback></Play_Control></AirPlay></YAMAHA_AV>',
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
      `${this.name}${this.sysConfig.YAMAHA_AV.System[0].Config[0].System_ID[0]}${this.zone}`,
    );
    let accessory;
    if (!this.accessories.find(accessory => accessory.UUID === uuid)) {
      this.log.info(`Creating Zone accessory for ${this.name}`);
      accessory = new this.api.platformAccessory(this.name, uuid);
    } else {
      this.log.info(`Wiring Zone accessory for ${this.name}`);
      accessory = this.accessories.find(accessory => accessory.UUID === uuid);
    }
    accessory.context = { yamaha: this.yamaha, zone: this.zone, updateStatus: [] };
    this.getServices(accessory);
    return accessory;
  }

  getServices(accessory) {

    const informationService =
      accessory.getService(this.api.hap.Service.AccessoryInformation) ||
      accessory.addService(this.api.hap.Service.AccessoryInformation);

    informationService
      .setCharacteristic(this.api.hap.Characteristic.Name, this.name)
      .setCharacteristic(this.api.hap.Characteristic.Manufacturer, 'yamaha-home')
      .setCharacteristic(
        this.api.hap.Characteristic.Model,
        this.sysConfig.YAMAHA_AV.System[0].Config[0].Model_Name[0],
      )
      .setCharacteristic(this.api.hap.Characteristic.FirmwareRevision, packageJson.version)
      .setCharacteristic(
        this.api.hap.Characteristic.SerialNumber,
        this.sysConfig.YAMAHA_AV.System[0].Config[0].System_ID[0],
      );

    if (this.zone === 'Main_Zone') {
      const mainPower =
        accessory.getService(this.api.hap.Service.Switch) ||
        accessory.addService(this.api.hap.Service.Switch, 'Yamaha Power');

      mainPower
        .getCharacteristic(this.api.hap.Characteristic.On)
        /*
        .onGet(async () => {
          try {
            return await this.yamaha.isOn();
          } catch (error) {
            this.log.error('Error getting Main Power:', error);
          }
        })
        */
        .onSet(async (value) => {
          try {
            await this.setPlaying(value);
          } catch (error) {
            this.log.error('Error setting Main Power:', error);
          }
        });

    }

    const zoneService =
      accessory.getService(this.api.hap.Service.Fan) ||
      accessory.addService(this.api.hap.Service.Fan, this.name);

    zoneService
      .getCharacteristic(this.api.hap.Characteristic.On)
      /*
      .onGet(async () => {
        try {
          return await this.yamaha.isOn(this.zone);
        } catch (error) {
          this.log.error('Error getting Power:', error);
        }
      })
      */
      .onSet(async (value) => {
        try {
          await this.setPlaying(value);
        } catch (error) {
          this.log.error('Error setting Power:', error);
        }
      });

    const volume =
      zoneService.getCharacteristic(this.api.hap.Characteristic.RotationSpeed) ||
      zoneService.addCharacteristic(this.api.hap.Characteristic.RotationSpeed);

    volume
      /*
        .onGet(async () => {
          try {
            const basicInfo = await this.yamaha.getBasicInfo(this.zone);
            const v = await basicInfo.getVolume() / 10.0;
            let p = 100 * ((v - this.minVolume) / this.gapVolume);
            p = Math.max(0, Math.min(100, Math.round(p)));
            debug(`Got volume percent of ${v}%, ${p}%`, this.zone);
            return p
          } catch (error) {
            this.log.error('Error getting volume:', error);
          }
        })
        */
      .onSet(async (value) => {
        try {
          const v = Math.round(((value / 100) * this.gapVolume) + this.minVolume) * 10.0;
          debug(`Setting volume to ${v}%, ${value}%`, this.zone);
          return await this.yamaha.setVolumeTo(v, this.zone);
        } catch (error) {
          this.log.error('Error setting volume:', error);
        }
      });
    accessory.context.updateStatus.push(this.getStatus);
    return accessory;
  }

  async getStatus(accessory) {
    for (const service of accessory.services) {
      //try {
      let value;
      switch (service.UUID) {
        case this.api.hap.Service.Switch.UUID:
          try {
            value = await accessory.context.yamaha.isOn(accessory.context.zone);
            service.getCharacteristic(this.api.hap.Characteristic.On).updateValue(value);
          } catch (error) {
            this.log.error('Error getting Power:', error);
            service.getCharacteristic(this.api.hap.Characteristic.On).updateValue(new this.api.hap.HapStatusError(this.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE));
            value = 'error';
          }
          debug('Status update %s Switch service %s to %s', service.displayName, accessory.context.zone, value);
          break;

        case this.api.hap.Service.Fan.UUID: {
          try {
            value = await accessory.context.yamaha.isOn(accessory.context.zone);
            service.updateCharacteristic(this.api.hap.Characteristic.On, value);
          } catch (error) {
            this.log.error('Error getting Power:', error);
            service.getCharacteristic(this.api.hap.Characteristic.On).updateValue(new this.api.hap.HapStatusError(this.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE));
            break;
          }
          const basicInfo = await accessory.context.yamaha.getBasicInfo(accessory.context.zone);

          if (typeof basicInfo.getVolume === 'function') {
            const volume = await basicInfo?.getVolume() / 10.0;
            let percentage = 100 * ((volume - this.minVolume) / this.gapVolume);
            percentage = Math.max(0, Math.min(100, Math.round(percentage)));
            service.getCharacteristic(this.api.hap.Characteristic.RotationSpeed).updateValue(percentage);
            debug(
              'Status update Fan service %s On to %s, and Volume to %s',
              accessory.context.zone,
              value,
              percentage,
            );
          } else {
            service.getCharacteristic(this.api.hap.Characteristic.RotationSpeed).updateValue(new this.api.hap.HapStatusError(this.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE));
          }
          break;
        }
        case this.api.hap.Service.AccessoryInformation.UUID:
          break;
        default:
          debug('Unknown service type: %s', service.UUID);
          break;
      }
      //} catch (error) {
      // this.log.error(
      //  `Error getting status for ${(service.name ? service.name : service.displayName)}:`,
      //error
      //  );
      //




    }
  }
}

module.exports = YamahaZone;
