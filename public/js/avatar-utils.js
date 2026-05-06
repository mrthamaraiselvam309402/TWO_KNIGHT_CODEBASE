// Avatar utility - generates SVG data URLs locally (no external dependency)
function generateAvatarURL(name, size = 80, bgColor = 'dca33e', textColor = '000000') {
  const initials = (name || '?')
    .toString()
    .trim()
    .split(/\s+/)
    .map(part => part[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();
  const fontSize = Math.floor(size * 0.4);
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '"><rect width="' + size + '" height="' + size + '" fill="#' + bgColor + '"/><text x="50%" y="50%" dominant-baseline="central" text-anchor="middle" font-family="Arial, sans-serif" font-weight="bold" font-size="' + fontSize + '" fill="#' + textColor + '">' + initials + '</text></svg>';
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}
