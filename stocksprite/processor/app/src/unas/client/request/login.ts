export const login = (apiKey: string): string => {
    return `<?xml version="1.0" encoding="UTF-8" ?>
        <Params>
            <ApiKey>${apiKey}</ApiKey>
            <WebshopInfo>true</WebshopInfo>
        </Params>`;
};
