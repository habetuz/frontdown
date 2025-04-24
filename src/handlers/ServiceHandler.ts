export default abstract class ServiceHandler {
  constructor(
    public name: string,
    public dataLocation: string,
  ) {}

  abstract stopService(): Promise<void>;
  abstract startService(): Promise<void>;
  abstract gatherData(): Promise<void>;
}
