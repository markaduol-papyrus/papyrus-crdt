import Char from './../lib/char.js';
import Identifier from './../lib/identifier.js';

function _getRandomInt() {
  return Math.floor(Math.random() * 1000);
}

function _getRandomChar() {
  return Math.floor(Math.random() * 36).toString(36);
}

//////////////////////////////// ACTUAL TESTS //////////////////////////////////

describe('Character comparison tests', () => {
  test('Compares primarily on character ID', () => {
    let siteId1 = 99;
    let siteId2 = 100;
    let siteId3 = 101;
    const randChar = _getRandomChar();
    const char1 = new Char(randChar, [new Identifier(0, siteId2)]);
    // Vary site ID
    const char2 = new Char(randChar, [new Identifier(1, siteId1)]);
    const char3 = new Char(randChar, [new Identifier(1, siteId2)]);
    const char4 = new Char(randChar, [new Identifier(1, siteId3)]);
    // Test
    expect(char1.compareTo(char2)).toEqual(-1);
    expect(char1.compareTo(char3)).toEqual(-1);
    expect(char1.compareTo(char4)).toEqual(-1);
  });

  test('Compares secondarily on site ID of identifier', () => {
    const siteId1 = 99;
    const siteId2 = 100;
    const siteId3 = 101;
    const randChar = _getRandomChar();
    const char1 = new Char(randChar, [new Identifier(0, siteId2)]);
    // Vary site ID
    const char2 = new Char(randChar, [new Identifier(0, siteId1)]);
    const char3 = new Char(randChar, [new Identifier(0, siteId3)]);
    // Test
    expect(char1.compareTo(char2)).toEqual(1);
    expect(char1.compareTo(char1)).toEqual(0);
    expect(char1.compareTo(char3)).toEqual(-1);
  });
});

describe('Returns correct values', () => {
  test('Returns site ID based on ID array', () => {
    const randInt = _getRandomInt();
    const randChar = _getRandomChar();
    const siteId = 100;
    const id1 = new Identifier(randInt, siteId);
    const id2 = new Identifier(randInt + 10, siteId);
    const char = new Char(randChar, [id1, id2]);
    expect(char.getSiteId()).toEqual(siteId);
  });

  test('Returns correct ID array', () => {
    const randInt = _getRandomInt();
    const randChar = _getRandomChar();
    const siteId = 100;
    const id1 = new Identifier(randInt, siteId);
    const id2 = new Identifier(randInt + 10, siteId);
    const idArr = [id1, id2];
    const char = new Char(randChar, idArr);
    expect(char.getIdArray()).toEqual(idArr);
  });
});
