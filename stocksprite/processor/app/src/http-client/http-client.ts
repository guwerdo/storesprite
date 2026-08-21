import { injectable } from "inversify";
import axios, { AxiosInstance } from "axios";
import { IAxiosHttpClient } from "./interfaces/http-client.interface.js";

@injectable()
export class AxiosHttpClient implements IAxiosHttpClient {
    public instance: AxiosInstance;

    constructor() {
       this.instance = axios.create(); // you can customize config here
    }
}

