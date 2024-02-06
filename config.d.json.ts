type TokenConfig = {
    tokens: string[];
} | {
    token: string;
};

type Config = {
    prefix: string;
    owners: string[];
    port?: number;
    // this is used to register application commands to a single server only
    devGuild?: string;
};

declare const value: Config & TokenConfig;

export default value;