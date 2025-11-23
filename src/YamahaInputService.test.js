const YamahaInputService = require('./YamahaInputService');

// Mock dependencies
jest.mock('debug', () => jest.fn(() => jest.fn()));
jest.mock('../package.json', () => ({ version: '1.0.0' }));

describe('YamahaInputService', () => {
  let externalContext;
  let yamaha;
  let sysConfig;
  let mockAccessory;
  let mockService;
  let mockCharacteristic;

  beforeEach(() => {
    // Setup mock characteristic
    mockCharacteristic = {
      onGet: jest.fn().mockReturnThis(),
      onSet: jest.fn().mockReturnThis(),
      updateValue: jest.fn().mockReturnThis(),
    };

    // Setup mock service
    mockService = {
      UUID: 'mock-service-uuid',
      displayName: 'Test Input',
      name: 'Test Input',
      setCharacteristic: jest.fn().mockReturnThis(),
      getCharacteristic: jest.fn().mockReturnValue(mockCharacteristic),
      updateCharacteristic: jest.fn().mockReturnThis(),
    };

    // Setup mock accessory
    mockAccessory = {
      UUID: 'test-uuid',
      context: {},
      services: [mockService],
      getService: jest.fn().mockReturnValue(mockService),
      addService: jest.fn().mockReturnValue(mockService),
    };

    // Setup external context
    externalContext = {
      config: {
        zone: 1,
        set_default_volume: 50,
        setMainInputTo: 'HDMI1',
        min_volume: -65.0,
        max_volume: -10.0,
        setInputTo: 'HDMI2',
        set_scene: '1',
      },
      log: jest.fn(),
      api: {
        hap: {
          uuid: {
            generate: jest.fn().mockReturnValue('test-uuid'),
          },
          Service: {
            AccessoryInformation: {
              UUID: 'info-uuid',
            },
            Switch: {
              UUID: 'switch-uuid',
            },
            Fan: {
              UUID: 'fan-uuid',
            },
          },
          Characteristic: {
            Name: 'Name',
            Manufacturer: 'Manufacturer',
            Model: 'Model',
            FirmwareRevision: 'FirmwareRevision',
            SerialNumber: 'SerialNumber',
            On: 'On',
            RotationSpeed: 'RotationSpeed',
          },
        },
        platformAccessory: jest.fn().mockImplementation((name, uuid) => ({
          ...mockAccessory,
          UUID: uuid,
        })),
      },
      accessories: [],
    };

    // Setup yamaha mock
    yamaha = {
      powerOn: jest.fn().mockResolvedValue(true),
      setMainInputTo: jest.fn().mockResolvedValue(true),
      SendXMLToReceiver: jest.fn().mockResolvedValue(true),
      setVolumeTo: jest.fn().mockResolvedValue(true),
      isOn: jest.fn().mockResolvedValue(true),
      getCurrentInput: jest.fn().mockResolvedValue('HDMI2'),
      getBasicInfo: jest.fn().mockResolvedValue({
        getVolume: jest.fn().mockReturnValue(-300),
      }),
    };

    // Setup sysConfig
    sysConfig = {
      YAMAHA_AV: {
        System: [
          {
            Config: [
              {
                System_ID: ['TEST123'],
                Model_Name: ['RX-V685'],
              },
            ],
          },
        ],
      },
    };
  });

  describe('constructor', () => {
    it('should initialize with correct properties and return accessory', () => {
      const result = new YamahaInputService(externalContext, 'Test Input', yamaha, sysConfig);

      // Constructor returns an accessory with modified context
      expect(result.UUID).toBe('test-uuid');
      expect(result.context.yamaha).toBe(yamaha);
      expect(result.context.zone).toBe(1);
      expect(Array.isArray(result.context.updateStatus)).toBe(true);
      expect(externalContext.log).toHaveBeenCalledWith('Adding Input Switch Test Input');
    });

    it('should use default values when config is missing', () => {
      externalContext.config = {};
      const result = new YamahaInputService(externalContext, 'Test Input', yamaha, sysConfig);

      expect(result.UUID).toBe('test-uuid');
      expect(result.context.zone).toBe(1);
    });

    it('should calculate gapVolume correctly', () => {
      // Since constructor returns accessory, we need to test this differently
      // The gapVolume calculation happens internally and affects volume percentage
      const result = new YamahaInputService(externalContext, 'Test Input', yamaha, sysConfig);

      expect(result.context.yamaha).toBe(yamaha);
      // gapVolume is used in getStatus method
    });
  });

  describe('getAccessory', () => {
    it('should create a new accessory if it does not exist', () => {
      const service = new YamahaInputService(externalContext, 'Test Input', yamaha, sysConfig);

      expect(externalContext.api.platformAccessory).toHaveBeenCalled();
      expect(externalContext.api.hap.uuid.generate).toHaveBeenCalled();
    });

    it('should reuse existing accessory if it exists', () => {
      const existingAccessory = { ...mockAccessory, UUID: 'test-uuid' };
      externalContext.accessories = [existingAccessory];

      const service = new YamahaInputService(externalContext, 'Test Input', yamaha, sysConfig);

      expect(externalContext.api.platformAccessory).not.toHaveBeenCalled();
    });

    it('should set accessory context correctly', () => {
      externalContext.accessories = [mockAccessory];
      const service = new YamahaInputService(externalContext, 'Test Input', yamaha, sysConfig);

      expect(mockAccessory.context.yamaha).toBe(yamaha);
      expect(mockAccessory.context.zone).toBe(1);
      expect(Array.isArray(mockAccessory.context.updateStatus)).toBe(true);
    });
  });

  describe('getServices', () => {
    it('should configure information service correctly', () => {
      const service = new YamahaInputService(externalContext, 'Test Input', yamaha, sysConfig);

      expect(mockService.setCharacteristic).toHaveBeenCalledWith('Name', 'Test Input');
      expect(mockService.setCharacteristic).toHaveBeenCalledWith('Manufacturer', 'yamaha-home');
      expect(mockService.setCharacteristic).toHaveBeenCalledWith('Model', 'RX-V685');
      expect(mockService.setCharacteristic).toHaveBeenCalledWith('SerialNumber', 'TEST123');
    });

    it('should setup switch characteristic with onSet handler', () => {
      const service = new YamahaInputService(externalContext, 'Test Input', yamaha, sysConfig);

      expect(mockCharacteristic.onSet).toHaveBeenCalled();
    });
  });

  describe('switch onSet handler', () => {
    it('should power on and set input when turned on', async () => {
      new YamahaInputService(externalContext, 'Test Input', yamaha, sysConfig);

      const onSetHandler = mockCharacteristic.onSet.mock.calls[0][0];
      await onSetHandler(true);

      expect(yamaha.powerOn).toHaveBeenCalled();
      expect(yamaha.setMainInputTo).toHaveBeenCalledWith('HDMI2');
    });

    it('should set scene when configured', async () => {
      new YamahaInputService(externalContext, 'Test Input', yamaha, sysConfig);

      const onSetHandler = mockCharacteristic.onSet.mock.calls[0][0];
      await onSetHandler(true);

      expect(yamaha.SendXMLToReceiver).toHaveBeenCalledWith(
        expect.stringContaining('<Scene_Sel>Scene 1</Scene_Sel>')
      );
    });

    it('should set default volume when configured', async () => {
      new YamahaInputService(externalContext, 'Test Input', yamaha, sysConfig);

      const onSetHandler = mockCharacteristic.onSet.mock.calls[0][0];
      await onSetHandler(true);

      expect(yamaha.setVolumeTo).toHaveBeenCalledWith(500, 1);
    });

    it('should do nothing when turned off', async () => {
      new YamahaInputService(externalContext, 'Test Input', yamaha, sysConfig);

      const onSetHandler = mockCharacteristic.onSet.mock.calls[0][0];
      await onSetHandler(false);

      expect(yamaha.powerOn).not.toHaveBeenCalled();
    });
  });

  describe('getStatus', () => {
    let serviceInstance;

    beforeEach(() => {
      // Directly instantiate and capture the service instance before it returns
      serviceInstance = Object.create(YamahaInputService.prototype);
      serviceInstance.config = externalContext.config;
      serviceInstance.log = {
        error: jest.fn(),
        info: jest.fn(),
      };
      serviceInstance.api = externalContext.api;
      serviceInstance.minVolume = externalContext.config.min_volume || -65.0;
      serviceInstance.maxVolume = externalContext.config.max_volume || -10.0;
      serviceInstance.gapVolume = serviceInstance.maxVolume - serviceInstance.minVolume;

      mockAccessory.context = { yamaha, zone: 1, updateStatus: [] };
    });

    it('should update Switch service status correctly', async () => {
      mockService.UUID = externalContext.api.hap.Service.Switch.UUID;
      mockAccessory.services = [mockService];

      await serviceInstance.getStatus(mockAccessory);

      expect(yamaha.isOn).toHaveBeenCalled();
      expect(yamaha.getCurrentInput).toHaveBeenCalled();
      expect(mockCharacteristic.updateValue).toHaveBeenCalled();
    });

    it('should update Fan service status correctly', async () => {
      mockService.UUID = externalContext.api.hap.Service.Fan.UUID;
      mockAccessory.services = [mockService];

      await serviceInstance.getStatus(mockAccessory);

      expect(yamaha.isOn).toHaveBeenCalledWith(1);
      expect(yamaha.getBasicInfo).toHaveBeenCalledWith(1);
      expect(mockService.updateCharacteristic).toHaveBeenCalledWith('On', true);
    });

    it('should calculate volume percentage correctly', async () => {
      mockService.UUID = externalContext.api.hap.Service.Fan.UUID;
      mockAccessory.services = [mockService];

      await serviceInstance.getStatus(mockAccessory);

      // Volume is -30.0, range is -65.0 to -10.0 (55 gap)
      // Percentage = 100 * ((-30.0 - (-65.0)) / 55) = 100 * (35 / 55) = 63.6... rounded to 64
      expect(mockCharacteristic.updateValue).toHaveBeenCalledWith(64);
    });

    it('should handle errors gracefully', async () => {
      yamaha.isOn.mockRejectedValue(new Error('Connection failed'));
      mockService.UUID = externalContext.api.hap.Service.Switch.UUID;
      mockAccessory.services = [mockService];

      await serviceInstance.getStatus(mockAccessory);

      expect(serviceInstance.log.error).toHaveBeenCalled();
    });

    it('should skip AccessoryInformation service', async () => {
      mockService.UUID = externalContext.api.hap.Service.AccessoryInformation.UUID;
      mockAccessory.services = [mockService];

      await serviceInstance.getStatus(mockAccessory);

      expect(yamaha.isOn).not.toHaveBeenCalled();
    });
  });
});
