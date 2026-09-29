export function redactAddressFromText(text: string, address: string | null) {
  if (!address) return text;
  return text.split(address).join("[redacted address]");
}
