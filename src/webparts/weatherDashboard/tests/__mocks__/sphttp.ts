// Mock for @microsoft/sp-http to avoid deep SPFx dependency chain in Jest tests

export class HttpClient {
  public static readonly configurations = {
    v1: { flags: {} },
  };
  public get: jest.Mock = jest.fn();
  public post: jest.Mock = jest.fn();
}

export class SPHttpClient {
  public static readonly configurations = {
    v1: { flags: {} },
  };
  public get: jest.Mock = jest.fn();
  public post: jest.Mock = jest.fn();
}

export class HttpClientResponse {
  public ok: boolean = true;
  public status: number = 200;
  public statusText: string = 'OK';
  public json(): Promise<unknown> { return Promise.resolve({}); }
  public text(): Promise<string> { return Promise.resolve(''); }
}

export class SPHttpClientResponse extends HttpClientResponse {}
