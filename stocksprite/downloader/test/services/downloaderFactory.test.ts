import "reflect-metadata";
import { describe, it, expect, vi } from "vitest";
import type { IDownloader } from "../../src/types/Downloader.interface.js";
import { DownloaderFactory } from "../../src/services/DownloaderFactory.js";

describe("DownloaderFactory", () => {
  const httpDownloader = { download: vi.fn() } as unknown as IDownloader;
  const sftpDownloader = { download: vi.fn() } as unknown as IDownloader;
  const factory = new DownloaderFactory(httpDownloader, sftpDownloader);

  it("returns the HTTP downloader for HTTP (case-insensitive)", () => {
    expect(factory.getDownloader("HTTP")).toBe(httpDownloader);
    expect(factory.getDownloader("http")).toBe(httpDownloader);
    expect(factory.getDownloader("Http")).toBe(httpDownloader);
  });

  it("returns the SFTP downloader for SFTP", () => {
    expect(factory.getDownloader("SFTP")).toBe(sftpDownloader);
  });

  it("throws for an unsupported channel, preserving the original casing", () => {
    expect(() => factory.getDownloader("FTP")).toThrow("Unsupported download channel: 'FTP'");
    expect(() => factory.getDownloader("ftps")).toThrow("Unsupported download channel: 'ftps'");
  });
});
