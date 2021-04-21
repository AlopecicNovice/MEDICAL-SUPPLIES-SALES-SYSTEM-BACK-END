const mongoose = require("mongoose");

const userAddressSchema = new mongoose.Schema({
  loginNumber: {
    type: String,
    require: true,
  },
  province: {
    // 省
    type: String,
  },
  city: {
    // 市（市辖区）
    type: String,
  },
  country: {
    // 县（区，市）
    type: String,
  },
  town: {
    // 镇（街道）
    type: String,
  },
  detailedAddress: {
    type: String,
  },
  defaultChoose: {
    type: Boolean,
  },
});

const useraddress = mongoose.model("useraddress", userAddressSchema);

module.exports = useraddress;
