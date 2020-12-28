import { PlatformConfig } from 'homebridge';

//Config
export interface MerossCloudPlatformConfig extends PlatformConfig {
  devicediscovery?: boolean;
  email?: string;
  password?: string;
}
