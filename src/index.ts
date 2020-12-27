import { API } from 'homebridge';
import { PLATFORM_NAME } from './settings';
import { MerossCloudPlatform } from './platform';

/**
 * This method registers the platform with Homebridge
 */
export = (api: API): void => {
  api.registerPlatform(PLATFORM_NAME, MerossCloudPlatform);
};
