/**
 * This class represents an NDN Data object.
 * Copyright (C) 2013-2015 Regents of the University of California.
 * @author: Meki Cheraoui
 * @author: Jeff Thompson <jefft0@remap.ucla.edu>
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 * A copy of the GNU Lesser General Public License is in the file COPYING.
 */

var Crypto = require("./crypto.js");
var Blob = require('./util/blob.js').Blob;
var SignedBlob = require('./util/signed-blob.js').SignedBlob;
var ChangeCounter = require('./util/change-counter.js').ChangeCounter;
var BinaryXMLEncoder = require('./encoding/binary-xml-encoder.js').BinaryXMLEncoder;
var NDNProtocolDTags = require('./util/ndn-protoco-id-tags.js').NDNProtocolDTags;
var DataUtils = require('./encoding/data-utils.js').DataUtils;
var Name = require('./name.js').Name;
var Sha256WithRsaSignature = require('./sha256-with-rsa-signature.js').Sha256WithRsaSignature;
var MetaInfo = require('./meta-info.js').MetaInfo;
var KeyLocator = require('./key-locator.js').KeyLocator;
var globalKeyManager = require('./security/key-manager.js').globalKeyManager;
var WireFormat = require('./encoding/wire-format.js').WireFormat;

/**
 * Create a new Data with the optional values.  There are 2 forms of constructor:
 * new Data([name] [, content]);
 * new Data(name, metaInfo [, content]);
 *
 * @constructor
 * @param {Name} name
 * @param {MetaInfo} metaInfo
 * @param {Buffer} content
 */
var Data = function Data(nameOrData, metaInfoOrContent, arg3)
{
  if (nameOrData instanceof Data) {
    // The copy constructor.
    var data = nameOrData;

    // Copy the name.
    this.name_ = new ChangeCounter(new Name(data.getName()));
    this.metaInfo_ = new ChangeCounter(new MetaInfo(data.getMetaInfo()));
    this.signature_ = new ChangeCounter(data.getSignature().clone());
    this.content_ = data.content_;
    this.defaultWireEncoding_ = data.getDefaultWireEncoding();
    this.defaultWireEncodingFormat_ = data.defaultWireEncodingFormat_;
  }
  else {
    var name = nameOrData;
    if (typeof name === 'string')
      this.name_ = new ChangeCounter(new Name(name));
    else
      this.name_ = new ChangeCounter(typeof name === 'object' && name instanceof Name ?
         new Name(name) : new Name());

    var metaInfo;
    var content;
    if (typeof metaInfoOrContent === 'object' &&
        metaInfoOrContent instanceof MetaInfo) {
      metaInfo = metaInfoOrContent;
      content = arg3;
    }
    else {
      metaInfo = null;
      content = metaInfoOrContent;
    }

    this.metaInfo_ = new ChangeCounter(typeof metaInfo === 'object' && metaInfo instanceof MetaInfo ?
      new MetaInfo(metaInfo) : new MetaInfo());

    this.content_ = typeof content === 'object' && content instanceof Blob ?
      content : new Blob(content, true);

    this.signature_ = new ChangeCounter(new Sha256WithRsaSignature());
    this.defaultWireEncoding_ = new SignedBlob();
    this.defaultWireEncodingFormat_ = null;
  }

  this.getDefaultWireEncodingChangeCount_ = 0;
  this.changeCount_ = 0;
};

exports.Data = Data;

/**
 * Get the data packet's name.
 * @returns {Name} The name.
 */
Data.prototype.getName = function()
{
  return this.name_.get();
};

/**
 * Get the data packet's meta info.
 * @returns {MetaInfo} The meta info.
 */
Data.prototype.getMetaInfo = function()
{
  return this.metaInfo_.get();
};

/**
 * Get the data packet's signature object.
 * @returns {Signature} The signature object.
 */
Data.prototype.getSignature = function()
{
  return this.signature_.get();
};

/**
 * Get the data packet's content.
 * @returns {Blob} The content as a Blob, which isNull() if unspecified.
 */
Data.prototype.getContent = function()
{
  return this.content_;
};

/**
 * @deprecated Use getContent. This method returns a Buffer which is the former
 * behavior of getContent, and should only be used while updating your code.
 */
Data.prototype.getContentAsBuffer = function()
{
  return this.content_.buf();
};

/**
 * Return the default wire encoding, which was encoded with
 * getDefaultWireEncodingFormat().
 * @returns {SignedBlob} The default wire encoding, whose isNull() may be true
 * if there is no default wire encoding.
 */
Data.prototype.getDefaultWireEncoding = function()
{
  if (this.getDefaultWireEncodingChangeCount_ != this.getChangeCount()) {
    // The values have changed, so the default wire encoding is invalidated.
    this.defaultWireEncoding_ = new SignedBlob();
    this.defaultWireEncodingFormat_ = null;
    this.getDefaultWireEncodingChangeCount_ = this.getChangeCount();
  }

  return this.defaultWireEncoding_;
};

/**
 * Get the WireFormat which is used by getDefaultWireEncoding().
 * @returns {WireFormat} The WireFormat, which is only meaningful if the
 * getDefaultWireEncoding() is not isNull().
 */
Data.prototype.getDefaultWireEncodingFormat = function()
{
  return this.defaultWireEncodingFormat_;
};

/**
 * Set name to a copy of the given Name.
 * @param {Name} name The Name which is copied.
 * @returns {Data} This Data so that you can chain calls to update values.
 */
Data.prototype.setName = function(name)
{
  this.name_.set(typeof name === 'object' && name instanceof Name ?
    new Name(name) : new Name());
  ++this.changeCount_;
  return this;
};

/**
 * Set metaInfo to a copy of the given MetaInfo.
 * @param {MetaInfo} metaInfo The MetaInfo which is copied.
 * @returns {Data} This Data so that you can chain calls to update values.
 */
Data.prototype.setMetaInfo = function(metaInfo)
{
  this.metaInfo_.set(typeof metaInfo === 'object' && metaInfo instanceof MetaInfo ?
    new MetaInfo(metaInfo) : new MetaInfo());
  ++this.changeCount_;
  return this;
};

/**
 * Set the signature to a copy of the given signature.
 * @param {Signature} signature The signature object which is cloned.
 * @returns {Data} This Data so that you can chain calls to update values.
 */
Data.prototype.setSignature = function(signature)
{
  this.signature_.set(signature == null ?
    new Sha256WithRsaSignature() : signature.clone());
  ++this.changeCount_;
  return this;
};

/**
 * Set the content to the given value.
 * @param {Blob|Buffer} content The content bytes. If content is not a Blob,
 * then create a new Blob to copy the bytes (otherwise take another pointer to
 * the same Blob).
 * @returns {Data} This Data so that you can chain calls to update values.
 */
Data.prototype.setContent = function(content)
{
  this.content_ = typeof content === 'object' && content instanceof Blob ?
    content : new Blob(content, true);
  ++this.changeCount_;
  return this;
};

/**
 * @deprecated Use KeyChain.sign. See examples/node/test-encode-decode-data.js .
 */
Data.prototype.sign = function(wireFormat)
{
  wireFormat = (wireFormat || WireFormat.getDefaultWireFormat());

  if (this.getSignatureOrMetaInfoKeyLocator() == null ||
      this.getSignatureOrMetaInfoKeyLocator().getType() == null)
    this.getMetaInfo().setFields();

  // Encode once to get the signed portion.
  var encoding = this.wireEncode(wireFormat);
  var rsa = Crypto.createSign('RSA-SHA256');
  rsa.update(encoding.signedBuf());

  var sig = new Buffer
    (DataUtils.toNumbersIfString(rsa.sign(globalKeyManager.privateKey)));
  this.signature_.get().setSignature(sig);
  ++this.changeCount_;
};

// The first time verify is called, it sets this to determine if a signature
//   buffer needs to be converted to a string for the crypto verifier.
Data.verifyUsesString = null;

/**
 * @deprecated Use KeyChain.verifyData. See examples/node/test-encode-decode-data.js .
 */
Data.prototype.verify = function(/*Key*/ key)
{
  if (key == null || key.publicKeyPem == null)
    throw new Error('Cannot verify Data without a public key.');

  if (Data.verifyUsesString == null) {
    var hashResult = Crypto.createHash('sha256').digest();
    // If the has result is a string, we assume that this is a version of
    //   crypto where verify also uses a string signature.
    Data.verifyUsesString = (typeof hashResult === 'string');
  }

  // wireEncode returns the cached encoding if available.
  var verifier = Crypto.createVerify('RSA-SHA256');
  verifier.update(this.wireEncode().signedBuf());
  var signatureBytes = Data.verifyUsesString ?
    DataUtils.toString(this.signature_.get().getSignature().buf()) : this.signature_.get().getSignature().buf();
  return verifier.verify(key.publicKeyPem, signatureBytes);
};

Data.prototype.getElementLabel = function() { return NDNProtocolDTags.Data; };

/**
 * Encode this Data for a particular wire format. If wireFormat is the default
 * wire format, also set the defaultWireEncoding field to the encoded result.
 * @param {WireFormat} wireFormat (optional) A WireFormat object used to encode
 * this object. If omitted, use WireFormat.getDefaultWireFormat().
 * @returns {SignedBlob} The encoded buffer in a SignedBlob object.
 */
Data.prototype.wireEncode = function(wireFormat)
{
  wireFormat = (wireFormat || WireFormat.getDefaultWireFormat());

  if (!this.getDefaultWireEncoding().isNull() &&
      this.getDefaultWireEncodingFormat() == wireFormat)
    // We already have an encoding in the desired format.
    return this.getDefaultWireEncoding();
  
  var result = wireFormat.encodeData(this);
  var wireEncoding = new SignedBlob
    (result.encoding, result.signedPortionBeginOffset,
     result.signedPortionEndOffset);

  if (wireFormat == WireFormat.getDefaultWireFormat())
    // This is the default wire encoding.
    this.setDefaultWireEncoding
      (wireEncoding, WireFormat.getDefaultWireFormat());
  return wireEncoding;
};

/**
 * Decode the input using a particular wire format and update this Data. If
 * wireFormat is the default wire format, also set the defaultWireEncoding to
 * another pointer to the input.
 * @param {Blob|Buffer} input The buffer with the bytes to decode.
 * @param {WireFormat} wireFormat (optional) A WireFormat object used to decode
 * this object. If omitted, use WireFormat.getDefaultWireFormat().
 */
Data.prototype.wireDecode = function(input, wireFormat)
{
  wireFormat = (wireFormat || WireFormat.getDefaultWireFormat());

  // If input is a blob, get its buf().
  var decodeBuffer = typeof input === 'object' && input instanceof Blob ?
                     input.buf() : input;
  var result = wireFormat.decodeData(this, decodeBuffer);

  if (wireFormat == WireFormat.getDefaultWireFormat())
    // This is the default wire encoding.  In the Blob constructor, set copy
    // true, but if input is already a Blob, it won't copy.
    this.setDefaultWireEncoding(new SignedBlob
      (new Blob(input, true), result.signedPortionBeginOffset,
       result.signedPortionEndOffset),
      WireFormat.getDefaultWireFormat());
  else
    this.setDefaultWireEncoding(new SignedBlob(), null);
};

/**
 * If getSignature() has a key locator, return it.  Otherwise, use
 * the deprecated key locator from getMetaInfo() for backward compatibility and print
 * a warning to console.log that the key locator has moved to the Signature
 * object.  If neither has a key locator, return an empty key locator.
 * When we stop supporting the key locator in MetaInfo, this function is not
 * necessary and we will just use the key locator in the Signature.
 * @returns {KeyLocator} The key locator to use.
 */
Data.prototype.getSignatureOrMetaInfoKeyLocator = function()
{
  if (!KeyLocator.canGetFromSignature(this.getSignature()))
    // The signature type doesn't support KeyLocator.
    return new KeyLocator();
  
  if (this.signature_.get() != null && this.signature_.get().getKeyLocator() != null &&
      this.signature_.get().getKeyLocator().getType() != null &&
      this.signature_.get().getKeyLocator().getType() >= 0)
    // The application is using the key locator in the correct object.
    return this.signature_.get().getKeyLocator();

  if (this.metaInfo_.get() != null && this.metaInfo_.get().locator != null &&
      this.metaInfo_.get().locator.getType() != null &&
      this.metaInfo_.get().locator.getType() >= 0) {
    console.log("WARNING: Temporarily using the key locator found in the MetaInfo - expected it in the Signature object.");
    console.log("WARNING: In the future, the key locator in the Signature object will not be supported.");
    return this.metaInfo_.get().locator;
  }

  // Return the empty key locator from the Signature object if possible.
  if (this.signature_.get() != null && this.signature_.get().getKeyLocator() != null)
    return this.signature_.get().getKeyLocator();
  else
    return new KeyLocator();
};

/**
 * Get the change count, which is incremented each time this object (or a child
 * object) is changed.
 * @returns {number} The change count.
 */
Data.prototype.getChangeCount = function()
{
  // Make sure each of the checkChanged is called.
  var changed = this.name_.checkChanged();
  changed = this.metaInfo_.checkChanged() || changed;
  changed = this.signature_.checkChanged() || changed;
  if (changed)
    // A child object has changed, so update the change count.
    ++this.changeCount_;

  return this.changeCount_;
};

// Since binary-xml-wire-format.js includes this file, put these at the bottom to avoid problems with cycles of require.
var BinaryXmlWireFormat = require('./encoding/binary-xml-wire-format.js').BinaryXmlWireFormat;

/**
 * @deprecated Use BinaryXmlWireFormat.decodeData.
 */
Data.prototype.from_ndnb = function(/*XMLDecoder*/ decoder)
{
  BinaryXmlWireFormat.decodeData(this, decoder);
};

/**
 * @deprecated Use BinaryXmlWireFormat.encodeData.
 */
Data.prototype.to_ndnb = function(/*XMLEncoder*/ encoder)
{
  BinaryXmlWireFormat.encodeData(this, encoder);
};

/**
 * @deprecated Use wireEncode.  If you need binary XML, use
 * wireEncode(BinaryXmlWireFormat.get()).
 */
Data.prototype.encode = function(wireFormat)
{
  wireFormat = (wireFormat || BinaryXmlWireFormat.get());
  return wireFormat.encodeData(this).buf();
};

/**
 * @deprecated Use wireDecode.  If you need binary XML, use
 * wireDecode(input, BinaryXmlWireFormat.get()).
 */
Data.prototype.decode = function(input, wireFormat)
{
  wireFormat = (wireFormat || BinaryXmlWireFormat.get());
  wireFormat.decodeData(this, input);
};

Data.prototype.setDefaultWireEncoding = function
  (defaultWireEncoding, defaultWireEncodingFormat)
{
  this.defaultWireEncoding_ = defaultWireEncoding;
  this.defaultWireEncodingFormat_ = defaultWireEncodingFormat;
  // Set getDefaultWireEncodingChangeCount_ so that the next call to
  // getDefaultWireEncoding() won't clear _defaultWireEncoding.
  this.getDefaultWireEncodingChangeCount_ = this.getChangeCount();
};

// Define properties so we can change member variable types and implement changeCount_.
Object.defineProperty(Data.prototype, "name",
  { get: function() { return this.getName(); },
    set: function(val) { this.setName(val); } });
Object.defineProperty(Data.prototype, "metaInfo",
  { get: function() { return this.getMetaInfo(); },
    set: function(val) { this.setMetaInfo(val); } });
Object.defineProperty(Data.prototype, "signature",
  { get: function() { return this.getSignature(); },
    set: function(val) { this.setSignature(val); } });
/**
 * @deprecated Use getMetaInfo and setMetaInfo.
 */
Object.defineProperty(Data.prototype, "signedInfo",
  { get: function() { return this.getMetaInfo(); },
    set: function(val) { this.setMetaInfo(val); } });
/**
 * @deprecated Use getContent and setContent.
 */
Object.defineProperty(Data.prototype, "content",
  { get: function() { return this.getContentAsBuffer(); },
    set: function(val) { this.setContent(val); } });

/**
 * @deprecated Use new Data.
 */
var ContentObject = function ContentObject(name, signedInfo, content)
{
  // Call the base constructor.
  Data.call(this, name, signedInfo, content);
}

ContentObject.prototype = new Data();

exports.ContentObject = ContentObject;
