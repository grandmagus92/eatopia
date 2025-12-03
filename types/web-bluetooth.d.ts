// types/web-bluetooth.d.ts
interface BluetoothRemoteGATTDescriptor {
  readonly characteristic: BluetoothRemoteGATTCharacteristic;
  readonly uuid: string;
  readonly value?: DataView;
  
  readValue(): Promise<DataView>;
  writeValue(value: BufferSource): Promise<void>;
}

interface BluetoothRemoteGATTCharacteristic {
  readonly service: BluetoothRemoteGATTService;
  readonly uuid: string;
  readonly properties: BluetoothCharacteristicProperties;
  readonly value?: DataView;
  
  getDescriptor(descriptor: string | number): Promise<BluetoothRemoteGATTDescriptor>;
  getDescriptors(): Promise<BluetoothRemoteGATTDescriptor[]>;
  readValue(): Promise<DataView>;
  writeValue(value: BufferSource): Promise<void>;
  writeValueWithoutResponse(value: BufferSource): Promise<void>;
  startNotifications(): Promise<BluetoothRemoteGATTCharacteristic>;
  stopNotifications(): Promise<void>;
  addEventListener(
    type: "characteristicvaluechanged",
    listener: (this: this, ev: Event) => any,
    useCapture?: boolean
  ): void;
  removeEventListener(
    type: "characteristicvaluechanged",
    listener: (this: this, ev: Event) => any,
    useCapture?: boolean
  ): void;
}

interface BluetoothRemoteGATTService {
  readonly device: BluetoothDevice;
  readonly uuid: string;
  readonly isPrimary: boolean;
  
  getCharacteristic(characteristic: string | number): Promise<BluetoothRemoteGATTCharacteristic>;
  getCharacteristics(): Promise<BluetoothRemoteGATTCharacteristic[]>;
  getIncludedService(service: string | number): Promise<BluetoothRemoteGATTService>;
  getIncludedServices(): Promise<BluetoothRemoteGATTService[]>;
}

interface BluetoothRemoteGATTServer {
  readonly device: BluetoothDevice;
  readonly connected: boolean;
  
  connect(): Promise<BluetoothRemoteGATTServer>;
  disconnect(): void;
  getPrimaryService(service: string | number): Promise<BluetoothRemoteGATTService>;
  getPrimaryServices(): Promise<BluetoothRemoteGATTService[]>;
}

interface BluetoothCharacteristicProperties {
  readonly authenticatedSignedWrites: boolean;
  readonly broadcast: boolean;
  readonly indicate: boolean;
  readonly notify: boolean;
  readonly read: boolean;
  readonly reliableWrite: boolean;
  readonly writableAuxiliaries: boolean;
  readonly write: boolean;
  readonly writeWithoutResponse: boolean;
}

interface BluetoothDevice {
  readonly id: string;
  readonly name?: string;
  readonly gatt?: BluetoothRemoteGATTServer;
  
  watchAdvertisements(): Promise<void>;
  unwatchAdvertisements(): void;
  addEventListener(
    type: "advertisementreceived" | "gattserverdisconnected",
    listener: (this: this, ev: Event) => any,
    useCapture?: boolean
  ): void;
  removeEventListener(
    type: "advertisementreceived" | "gattserverdisconnected",
    listener: (this: this, ev: Event) => any,
    useCapture?: boolean
  ): void;
}

interface BluetoothManufacturerData extends Map<number, DataView> {}
interface BluetoothServiceData extends Map<string, DataView> {}

interface BluetoothAdvertisingEvent extends Event {
  readonly device: BluetoothDevice;
  readonly uuids: string[];
  readonly manufacturerData: BluetoothManufacturerData;
  readonly serviceData: BluetoothServiceData;
  readonly name?: string;
  readonly appearance?: number;
  readonly txPower?: number;
  readonly rssi?: number;
}

interface BluetoothLEScanFilter {
  readonly name?: string;
  readonly namePrefix?: string;
  readonly services?: (string | number)[];
  readonly manufacturerData?: BluetoothManufacturerDataFilter[];
}

interface BluetoothManufacturerDataFilter {
  readonly companyIdentifier: number;
  readonly dataPrefix?: BufferSource;
  readonly mask?: BufferSource;
}

interface BluetoothServiceUUID {
  readonly uuid: string;
}

interface RequestDeviceOptions {
  filters?: BluetoothLEScanFilter[];
  optionalServices?: (string | number)[];
  optionalManufacturerData?: number[];
  acceptAllDevices?: boolean;
}

interface Bluetooth {
  requestDevice(options?: RequestDeviceOptions): Promise<BluetoothDevice>;
  getAvailability(): Promise<boolean>;
  onavailabilitychanged: ((this: this, ev: Event) => any) | null;
}

// Deklarasi untuk Navigator
interface Navigator {
  bluetooth: Bluetooth;
}

interface BluetoothUUID {
  getService(name: string | number): string;
  getCharacteristic(name: string | number): string;
  getDescriptor(name: string | number): string;
  canonicalUUID(alias: string | number): string;
}