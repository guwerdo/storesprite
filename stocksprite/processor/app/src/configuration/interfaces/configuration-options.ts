export class ConfigurationOptions<T> {
    constructor(
        private readonly sectionName: string,
        private readonly config: T,
    ) {}

    get value(): T {
        return this.config;
    }

    get section(): string {
        return this.sectionName;
    }
}
