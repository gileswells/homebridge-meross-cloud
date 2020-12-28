import { API, DynamicPlatformPlugin, Logger, PlatformAccessory, Service, Characteristic } from 'homebridge';
import { PLATFORM_NAME, PLUGIN_NAME } from './settings';
import { mss620 } from './Devices/mss620';
import { MerossCloudPlatformConfig } from './configTypes';
import MerossCloud from 'meross-cloud';

/**
 * HomebridgePlatform
 * This class is the main constructor for your plugin, this is where you should
 * parse the user config and discover/register accessories with Homebridge.
 */
export class MerossCloudPlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service = this.api.hap.Service;
  public readonly Characteristic: typeof Characteristic = this.api.hap.Characteristic;

  // this is used to track restored cached accessories
  public readonly accessories: PlatformAccessory[] = [];

  constructor(public readonly log: Logger, public readonly config: MerossCloudPlatformConfig, public readonly api: API) {
    this.log.debug('Finished initializing platform:', this.config.name);
    // only load if configured
    if (!this.config) {
      return;
    }

    // verify the config
    try {
      this.verifyConfig();
      this.log.debug('Config OK');
    } catch (e) {
      this.log.error(JSON.stringify(e.message));
      this.log.debug(JSON.stringify(e));
      return;
    }

    // When this event is fired it means Homebridge has restored all cached accessories from disk.
    // Dynamic Platform plugins should only register new accessories after this event was fired,
    // in order to ensure they weren't added to homebridge already. This event can also be used
    // to start discovery of new accessories.
    this.api.on('didFinishLaunching', async () => {
      log.debug('Executed didFinishLaunching callback');
      // run the method to discover / register your devices as accessories
      try {
        this.discoverDevices();
      } catch (e) {
        this.log.error('Failed to Discover Devices.', JSON.stringify(e.message));
        this.log.debug(JSON.stringify(e));
      }
    });
  }

  /**
   * This function is invoked when homebridge restores cached accessories from disk at startup.
   * It should be used to setup event handlers for characteristics and update respective values.
   */
  configureAccessory(accessory: PlatformAccessory) {
    this.log.info('Loading accessory from cache:', accessory.displayName);

    // add the restored accessory to the accessories cache so we can track if it has already been registered
    this.accessories.push(accessory);
  }

  /**
   * Verify the config passed to the plugin is valid
   */
  verifyConfig() {
    /**
     * Hidden Device Discovery Option
     * This will disable adding any device and will just output info.
     */
    this.config.devicediscovery;
    this.config!.email!;
    this.config!.password!;
  }

  discoverDevices() {
    const options: any = {
      'email': this.config.email,
      'password': this.config.password,
    };

    const meross = new MerossCloud(options);

    meross.on('deviceInitialized', (deviceId, deviceDef, device) => {
      this.log.debug('New device ' + deviceId + ': ' + JSON.stringify(deviceDef));
      this.deviceInfo(meross, deviceDef, device);

      device.on('connected', () => {
        // For Future Devices
        switch (deviceDef.deviceType) {
          case 'mss620':
            this.log.info('Discovered %s %s', deviceDef.devName, deviceDef.deviceType, deviceDef.uuid);
            this.createMSS620(deviceDef);
            break;
          default:
            this.log.info(
              `A Meross Device has been discovered with Device Type: ${deviceDef.deviceType}, which is currently not supported.`,
              'Enable Device Discovery on Plugin Settings, Then Submit Meross Cloud Info Here: https://git.io/JLD51.',
              //'Submit Feature Requests Here: https://git.io/JLD5y,',
            );
        }
      });
    });

    meross.connect((error) => {
      this.log.debug('connect error: ' + error);
    });
  }

  private async createMSS620(deviceDef) {
    const uuid = this.api.hap.uuid.generate(`${deviceDef.devName}-${deviceDef.uuid}-${deviceDef.deviceType}`);

    // see if an accessory with the same uuid has already been registered and restored from
    // the cached devices we stored in the `configureAccessory` method above
    const existingAccessory = this.accessories.find((accessory) => accessory.UUID === uuid);

    if (existingAccessory) {
      // the accessory already exists
      if (deviceDef.onlineStatus === 1) {
        this.log.info('Restoring existing accessory from cache:', existingAccessory.displayName);

        // if you need to update the accessory.context then you should run `api.updatePlatformAccessories`. eg.:
        //existingAccessory.context.firmwareRevision = firmware;
        this.api.updatePlatformAccessories([existingAccessory]);
        // create the accessory handler for the restored accessory
        // this is imported from `platformAccessory.ts`
        new mss620(this, existingAccessory, deviceDef);
        this.log.debug(`Humidifier UDID: ${deviceDef.devName}-${deviceDef.uuid}-${deviceDef.deviceType}`);
      } else {
        this.unregisterPlatformAccessories(existingAccessory);
      }
    } else {
      // the accessory does not yet exist, so we need to create it
      this.log.info('Adding new accessory:', `${deviceDef.devName} ${deviceDef.deviceType}`);
      this.log.debug(`Registering new device: ${deviceDef.devName} ${deviceDef.deviceType} - ${deviceDef.uuid}`);

      // create a new accessory
      const accessory = new this.api.platformAccessory(`${deviceDef.devName} ${deviceDef.deviceType}`, uuid);

      // store a copy of the device object in the `accessory.context`
      // the `context` property can be used to store any data about the accessory you may need
      //accessory.context.firmwareRevision = firmware;
      //accessory.context.device = device;
      // accessory.context.firmwareRevision = findaccessories.accessoryAttribute.softwareRevision;
      // create the accessory handler for the newly create accessory
      // this is imported from `platformAccessory.ts`
      new mss620(this, accessory, deviceDef);
      this.log.debug(`Humidifier UDID: ${deviceDef.devName}-${deviceDef.uuid}-${deviceDef.deviceType}`);

      // link the accessory to your platform
      this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
      this.accessories.push(accessory);
    }
  }

  public unregisterPlatformAccessories(existingAccessory: PlatformAccessory) {
    // remove platform accessories when no longer present
    this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [existingAccessory]);
    this.log.info('Removing existing accessory from cache:', existingAccessory.displayName);
  }

  public deviceInfo(meross, deviceDef, device) {
    if (this.config.devicediscovery) {
      this.log.warn(JSON.stringify(meross));
      this.log.warn(JSON.stringify(deviceDef));
      this.log.warn(JSON.stringify(device));
    }
  }
}
