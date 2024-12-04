const YamahaZone = require('./yamahaZone');

describe('YamahaZone', () => {
  let externalContext;
  let name;
  let yamaha;
  let sysConfig;
  let zone;

  beforeEach(() => {
    externalContext = {
      log: jest.fn(),
      config: {},
      api: {hap: {uuid: {generate: jest.fn()}}},
    };
    name = 'Test Zone';
    yamaha = {};
    sysConfig = {"YAMAHA_AV":{"$":{"rsp":"GET","RC":"0"},"System":[{"Config":[{"Model_Name":["RX-V1075"],"System_ID":["0AA88593"],"Version":["1.93/2.13"],"Feature_Existence":[{"Main_Zone":["1"],"Zone_2":["1"],"Zone_3":["0"],"Zone_4":["0"],"Tuner":["1"],"DAB":["0"],"HD_Radio":["0"],"Rhapsody":["1"],"Napster":["0"],"SiriusXM":["1"],"Spotify":["1"],"Pandora":["1"],"SERVER":["1"],"NET_RADIO":["1"],"USB":["1"],"iPod_USB":["1"],"AirPlay":["1"]}],"Name":[{"Input":[{"MULTI_CH":["MULTI CH"],"PHONO":["PHONO"],"AV_1":["Apple TV"],"AV_2":["KODI"],"AV_3":["AV3"],"AV_4":["AV4"],"AV_5":["AV5"],"AV_6":["AV6"],"AV_7":["AV7"],"V_AUX":["V-AUX"],"AUDIO_1":["AUDIO1"],"AUDIO_2":["AUDIO2"],"AUDIO_3":["AUDIO3"],"AUDIO_4":["AUDIO4"],"USB":["USB"]}]}]}]}]}};
    zone = 1;
  });

  it.skip('should initialize YamahaZone with correct properties', () => {
    const zoneInstance = new YamahaZone(externalContext, name, yamaha, sysConfig, zone);

    expect(zoneInstance.externalContext).toBe(externalContext);
    expect(zoneInstance.yamaha).toBe(yamaha);
    expect(zoneInstance.sysConfig).toBe(sysConfig);
    expect(zoneInstance.log).toBe(externalContext.log);
    expect(zoneInstance.api).toBe(externalContext.api);
    expect(zoneInstance.minVolume).toBe(-65.0);
    expect(zoneInstance.maxVolume).toBe(-10.0);
    expect(zoneInstance.gapVolume).toBe(zoneInstance.maxVolume - zoneInstance.minVolume);
    expect(zoneInstance.zone).toBe(zone);
    expect(zoneInstance.zoneNameMap).toEqual({});
    expect(zoneInstance.name).toBe(name);

    // Add additional assertions if needed
  });
});