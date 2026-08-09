export interface ICsvStreamFactory {
    createStream(): NodeJS.WritableStream;
}
