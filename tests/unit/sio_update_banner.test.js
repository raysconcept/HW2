const fs = require('fs');
const path = require('path');

function extractUpdateBanner() {
  const ejsPath = path.join(__dirname, '../../views/__HW_SIO.ejs');
  const fileContents = fs.readFileSync(ejsPath, 'utf8');
  const signature = 'function updateBanner(mode)';
  const startIndex = fileContents.indexOf(signature);
  if (startIndex === -1) {
    throw new Error('updateBanner function not found in __HW_SIO.ejs');
  }

  let braceDepth = 0;
  let endIndex = -1;
  for (let i = startIndex; i < fileContents.length; i += 1) {
    const char = fileContents[i];
    if (char === '{') {
      braceDepth += 1;
    } else if (char === '}') {
      braceDepth -= 1;
      if (braceDepth === 0) {
        endIndex = i;
        break;
      }
    }
  }
  if (endIndex === -1) {
    throw new Error('Unable to determine updateBanner function body');
  }

  const functionSource = fileContents.slice(startIndex, endIndex + 1);
  const factory = new Function('document', `${functionSource}; return updateBanner;`);
  return factory;
}

describe('updateBanner DOM helper', () => {
  const bannerTemplate = () => {
    const classes = new Set(['system-mode-banner', 'normal']);
    return {
      textContent: 'CAUTION: Retail database active',
      classList: {
        add: (cls) => classes.add(cls),
        remove: (...cls) => cls.forEach(c => classes.delete(c)),
        contains: (cls) => classes.has(cls),
        list: classes
      }
    };
  };

  test('switches to dev mode banner styling and text', () => {
    const banner = bannerTemplate();
    const documentStub = {
      querySelector: jest.fn(() => banner)
    };
    const updateBanner = extractUpdateBanner()(documentStub);

    updateBanner('SYSTEM_DEVMODE');

    expect(banner.classList.contains('dev')).toBe(true);
    expect(banner.classList.contains('normal')).toBe(false);
    expect(banner.textContent).toBe('Developer database active');
  });

  test('clears banner when mode is unknown and handles missing node', () => {
    const banner = bannerTemplate();
    const documentStub = {
      querySelector: jest
        .fn()
        .mockReturnValueOnce(banner)
        .mockReturnValueOnce(null)
    };
    const updateBanner = extractUpdateBanner()(documentStub);

    updateBanner('UNKNOWN');
    expect(banner.textContent).toBe('');
    expect(documentStub.querySelector).toHaveBeenCalledTimes(1);

    expect(() => updateBanner('SYSTEM_DEVMODE')).not.toThrow();
    expect(documentStub.querySelector).toHaveBeenCalledTimes(2);
  });
});
