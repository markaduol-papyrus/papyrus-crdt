class Identifier {
  constructor(value, siteId) {
    this.value = value;
    this.siteId = siteId;
  }

  getValue() {
    return this.value;
  }

  getSiteId() {
    return this.siteId;
  }

  compareTo(other) {
    if (!(other instanceof Identifier)) {
      throw new TypeError(`${other} is not an instance of Identifier`);
    }
    if (this.value < other.value) {
      return -1;
    } else if (this.value > other.value) {
      return 1;
    } else {
      if (this.siteId < other.siteId) {
        return -1;
      } else if (this.siteId > other.siteId) {
        return 1;
      } else {
        return 0;
      }
    }
  }
}

export default Identifier;
