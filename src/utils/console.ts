const isProduction = process.env['NODE_ENV'] === 'production' || false;

export const consoleError = (data: any) => {
  if (isProduction) return;
  console.error(data);
};

export const consoleLog = (data: any) => {
  if (isProduction) return;
  console.log(data);
};

export const consoleWarn = (data: any) => {
  if (isProduction) return;
  console.warn(data);
};

export const consoleInfo = (data: any) => {
  if (isProduction) return;
  console.info(data);
};

export const consoleDir = (data: any) => {
  if (isProduction) return;
  console.dir(data);
};
