export function createDemoAccessToken(password: string) {
  return password;
}

export function isValidDemoAccessToken(token: string | undefined, password: string) {
  return Boolean(token && token === password);
}
