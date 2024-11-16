const debug = require('debug')('yamaha-Spotify');

class YamahaSpotify {
  constructor(externalContext, name, yamaha, sysConfig) {
    this.log = externalContext.log;
    this.config = externalContext.config;
    this.api = externalContext.api;
    this.accessories = externalContext.accessories;
    this.yamaha = yamaha;
    this.sysConfig = sysConfig;

    this.nameSuffix = this.config["name_suffix"] || " Party Mode";
    this.zone = this.config["zone"] || 1;
    this.name = `Spotify '${name}`;
    this.serviceName = name;
    this.setMainInputTo = this.config["setMainInputTo"];
    this.playVolume = this.config["play_volume"];
    this.minVolume = this.config["min_volume"] || -65.0;
    this.maxVolume = this.config["max_volume"] || -10.0;
    this.gapVolume = this.maxVolume - this.minVolume;
    this.showInputName = this.config["show_input_name"] || "no";

    this.log(`Adding Spotify button ${this.name}`);
    return this.getAccessory();
  }

  getAccessory() {
    const uuid = this.api.hap.uuid.generate(
      `${this.name}${this.sysConfig.YAMAHA_AV.System[0].Config[0].System_ID[0]}${this.zone}`
    );
    console.log(uuid, `${this.name}${this.sysConfig.YAMAHA_AV.System[0].Config[0].System_ID[0]}${this.zone}`);
    var accessory;
    if (!this.accessories.find(accessory => accessory.UUID === uuid)) {
      this.log.info(`Creating YamahaSpotify accessory for ${this.name}`);
      accessory = new this.api.platformAccessory(this.name, uuid);
    } else {
      this.log.info(`Wiring YamahaSpotify accessory for ${this.name}`);
      accessory = this.accessories.find(accessory => accessory.UUID === uuid);
    }
    accessory.context = { yamaha: this.yamaha, zone: this.zone, updateStatus: [] };
    this.getServices(accessory);
    return accessory;
  }

  getServices(accessory) {
    const services = [];
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

    ["Play", "Pause", "Skip Fwd", "Skip Rev"].forEach((button) => {
      const spotifyButton = accessory.getService(this.api.hap.Service.Switch, `${button} '${this.serviceName}`, button) ||
        accessory.addService(this.api.hap.Service.Switch, `${button} '${this.serviceName}`, button);

      debug("Adding Spotify Button", spotifyButton.displayName);

      spotifyButton
        .getCharacteristic(this.api.hap.Characteristic.On)
        .onSet(async (value) => {
          try {
            if (on) {
              // Send the command to Yamaha receiver
              await this.yamaha.SendXMLToReceiver(
                `<YAMAHA_AV cmd="PUT"><Spotify><Play_Control><Playback>${spotifyButton.subtype}</Playback></Play_Control></Spotify></YAMAHA_AV>`
              );

              // Reset the button state after 5 seconds
              setTimeout(() => {
                spotifyButton.setCharacteristic(this.api.hap.Characteristic.On, 0);
              }, 5 * 1000);
            }
          } catch (error) {
            this.log.error('Error setting spotifyButton:', error);
          }
        });

    });
    accessory.context.updateStatus.push(this.getStatus);
    return;
  }

  async getStatus(accessory) {
    for (const service of accessory.services) {
      try {
        let value;
        switch (service.UUID) {
          case this.api.hap.Service.Switch.UUID:
            const value = await accessory.context.yamaha.isPartyModeEnabled();
            service.getCharacteristic(this.api.hap.Characteristic.On).updateValue(value);
            debug('Updating Spotify %s Switch status to %s', service.displayName, value);
            break;
          case this.api.hap.Service.AccessoryInformation.UUID:
            break;
          default:
            debug('Unknown service type: %s', service.UUID);
            break;
        }
      } catch (error) {
        this.log.error(
          `Error getting status for ${(service.name ? service.name : service.displayName)}:`,
          error
        );
      }
    }
  }
}

module.exports = YamahaSpotify;
