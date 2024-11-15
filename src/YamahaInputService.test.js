const YamahaInputService = require('./YamahaInputService');

describe('YamahaInputService', () => {
  let externalContext;
  let name;
  let yamaha;
  let sysConfig;
  let config;

  beforeEach(() => {
    externalContext = {
      log: jest.fn(),
      config: {},
      api: {},
    };
    name = 'Test Input';
    yamaha = {};
    sysConfig = {};
    config = {
      name_suffix: ' Party Mode',
      zone: 1,
      set_default_volume: true,
      default_service_name: 'Default Service',
      setMainInputTo: 'Main Input',
      play_volume: 50,
      min_volume: -65.0,
      max_volume: -10.0,
      show_input_name: 'yes',
      setInputTo: 'Input',
      set_scene: {},
    };
  });

  it('should initialize YamahaInputService with correct properties', () => {
    const inputService = new YamahaInputService(externalContext, name, yamaha, sysConfig, config);

    expect(inputService.log).toBe(externalContext.log);
    expect(inputService.config).toBe(externalContext.config);
    expect(inputService.api).toBe(externalContext.api);
    expect(inputService.yamaha).toBe(yamaha);
    expect(inputService.sysConfig).toBe(sysConfig);
    expect(inputService.nameSuffix).toBe(config.name_suffix);
    expect(inputService.zone).toBe(config.zone);
    expect(inputService.name).toBe(name);
    // expect(inputService.setDefaultVolume).toBe(config.set_default_volume);
    // expect(inputService.serviceName).toBe(name);
    // expect(inputService.defaultServiceName).toBe(config.default_service_name);
    // expect(inputService.setMainInputTo).toBe(config.setMainInputTo);
    // expect(inputService.playVolume).toBe(config.play_volume);
    // expect(inputService.minVolume).toBe(config.min_volume);
    // expect(inputService.maxVolume).toBe(config.max_volume);
    // expect(inputService.gapVolume).toBe(config.max_volume - config.min_volume);
    // expect(inputService.showInputName).toBe(config.show_input_name);
    // expect(inputService.setInputTo).toBe(config.setInputTo);
    // expect(inputService.setScene).toBe(config.set_scene);

    expect(externalContext.log).toHaveBeenCalledWith(`Adding Input Switch ${name}`);
  });
});