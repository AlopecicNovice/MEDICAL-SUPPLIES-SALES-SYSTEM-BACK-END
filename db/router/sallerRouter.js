const express = require("express");
const router = express.Router();
const Saller = require("@model/sallerModel");
const verificationCodeModel = require("@model/verificationCodeModel");
const CommodityModel = require("@model/commodityModel");
const orderModel = require("@model/orderModel");
const loginCookie = require("@utils/loginCookie");
const updateVerificationCode = require("@utils/updateVerificationCode");
const { classification } = require("@data/commodityClassification");
const getCrypto = require("@utils/getCrypto");

router.post("/login", (req, res) => {
  const { loginNumber, passWord } = req.body;
  if (!loginNumber || !passWord) {
    res.send({ code: -1, msg: "参数为空" });
    return;
  }
  Saller.find({
    $or: [
      {
        loginNumber,
        passWord,
      },
      {
        mailBox: loginNumber,
        passWord,
      },
    ],
  })
    .then(async (response) => {
      if (!response.length) {
        res.send({ code: -2, msg: "登陆失败，账号或密码错误" });
        return;
      }
      const loginToken = await loginCookie.getLoginCookie(loginNumber, 0);
      updateVerificationCode(loginNumber, "", -1).then(() => {
        res.cookie("sallerToken", loginToken, { path: "/" });
        res.send({ code: 0, msg: "登陆成功" });
      });
    })
    .catch((err) => {
      console.log(err);
      res.send({ code: -1, msg: "数据查询错误！" });
    });
});

router.post("/logout", (req, res) => {
  const { loginNumber } = req.body;
  console.log(loginNumber);
  if (!loginNumber) {
    res.send({ code: -1, msg: "参数为空" });
    return;
  }
  Saller.find({
    $or: [
      {
        loginNumber,
      },
      {
        mailBox: loginNumber,
      },
    ],
  })
    .then(async (response) => {
      console.log(response);
      if (!response.length) {
        res.send({ code: -2, msg: "退出失败" });
        return;
      }
      res.clearCookie("sallerToken", { path: "/" });
      res.send({ code: 0, msg: "退出成功" });
    })
    .catch((err) => {
      console.log(err);
      res.send({ code: -1, msg: "数据查询错误！" });
    });
});

router.post("/register", async (req, res) => {
  const {
    loginNumber,
    verificationCode,
    sallerName,
    passWord,
    mailBox,
    phoneNumber,
  } = req.body;
  if (
    !loginNumber ||
    !passWord ||
    !sallerName ||
    !mailBox ||
    !verificationCode ||
    !phoneNumber
  ) {
    res.send({ code: -1, msg: "参数为空" });
    return;
  }
  try {
    const findMailBox = await Saller.find({
      mailBox,
    });
    if (findMailBox.length) {
      res.send({ code: -2, msg: "此邮箱已被注册，请找回密码" });
      return;
    }
    const findLoginNumber = await Saller.find({
      loginNumber,
    });
    if (findLoginNumber.length) {
      res.send({ code: -2, msg: "此账号已存在，请找回密码" });
      return;
    }

    verificationCodeModel.find({ mailBox }).then((response) => {
      if (!response.length) {
        res.send({ code: -2, msg: "邀请码不正确" });
        return;
      }
      const { codeNumber, time } = response[0];

      if (codeNumber !== verificationCode) {
        res.send({ code: -2, msg: "邀请码不正确" });
      } else if (Date.now() - time >= 86400000) {
        res.send({ code: -2, msg: "邀请码失效" });
      } else {
        Saller.insertMany({
          loginNumber,
          passWord,
          sallerName,
          mailBox,
          phoneNumber,
        })
          .then(async () => {
            const loginToken = await loginCookie.getLoginCookie(loginNumber, 0);
            res.cookie("sallerToken", loginToken, { path: "/" });
            res.send({ code: 0, msg: "注册成功" });
          })
          .catch((err) => {
            console.log("注册");
            console.log(err);
            res.send({ code: -2, msg: "注册失败" });
          });
      }
    });
  } catch (err) {
    console.log(err);
  }
});

router.post("/getOrder", (req, res) => {
  const { sallerId } = req.body;
  if (!sallerId) {
    res.send({ code: -1, msg: "参数为空" });
    return;
  }
  orderModel
    .find({ sallerId })
    .then((response) => {
      res.send({ code: 0, msg: "查询成功", content: response });
    })
    .catch((err) => {
      console.log(err);
      res.send({ code: -2, msg: "查询错误" });
    });
});

router.post("/createMyCommodity", async (req, res) => {
  const { createInfo, userId } = req.body;
  if (!createInfo || !userId) {
    res.send({ code: -1, msg: "参数为空" });
    return;
  }
  try {
    const sallerInfo = Saller.findById(userId);
    const commodityList = await CommodityModel.find();
    const insertData = {
      commodityNumber: commodityList.length + Math.floor(Math.random() * 10),
      commodityName: createInfo.commodityName,
      commodityCurrentCount: createInfo.commodityCurrentCount,
      commodityImgUrl: "test",
      introduction: createInfo.introduction,
      marketValue: createInfo.marketValue,
      memberValue: createInfo.memberValue,
      sallerId: userId,
      sallerName: sallerInfo.sallerName,
      sallerPhone: "4564648",
      classificationNumber: createInfo.classificationNumber,
      classificationName: classification[createInfo.classificationNumber],
      updateTime: Date.now(),
    };
    CommodityModel.insertMany(insertData).then((response) => {
      res.send({ code: 0, msg: "成功", content: response });
      console.log(response.length);
    });
  } catch (err) {
    console.log(err);
    res.send({ code: -1, msg: "出错" });
  }
});

router.post("/confirmReceive", async (req, res) => {
  const { orderNumber } = req.body;
  if (!orderNumber) {
    res.send({ code: -1, msg: "参数为空" });
    return;
  }
  try {
    orderModel
      .findOneAndUpdate({ orderNumber }, { $set: { commodityStatus: 7 } })
      .then((response) => {
        res.send({ code: 0, msg: "成功", content: response });
      });
  } catch (err) {
    console.log(err);
    res.send({ code: -1, msg: "失败" });
  }
});

router.post("/getMyCommodity", async (req, res) => {
  const { userId } = req.body;
  if (!userId) {
    res.send({ code: -1, msg: "参数为空" });
    return;
  }
  try {
    const commodityList = await CommodityModel.find({ sallerId: userId });
    commodityList.sort((pre, next) => next.updateTime - pre.updateTime);
    res.send({ code: 0, msg: "成功", content: commodityList });
  } catch (err) {
    console.log(err);
    res.send({ code: -1, msg: "出错" });
  }
});

router.post("/updateCommodity", async (req, res) => {
  const { updateCommodity } = req.body;
  console.log(updateCommodity);
  if (!updateCommodity) {
    res.send({ code: -1, msg: "参数为空" });
    return;
  }
  try {
    const updateResponse = await CommodityModel.findOneAndUpdate(
      { commodityNumber: updateCommodity.commodityNumber },
      {
        $set: {
          commodityName: updateCommodity.commodityName,
          marketValue: updateCommodity.marketValue,
          memberValue: updateCommodity.memberValue,
          commodityCurrentCount: updateCommodity.commodityCurrentCount,
          introduction: updateCommodity.introduction,
          updateTime: Date.now(),
        },
      }
    );
    res.send({ code: 0, msg: "成功", content: updateResponse });
  } catch (err) {
    console.log(err);
    res.send({ code: -1, msg: "出错" });
  }
});

router.post("/deleteCommodity", async (req, res) => {
  const { commodityNumber } = req.body;
  if (!commodityNumber) {
    res.send({ code: -1, msg: "参数为空" });
    return;
  }
  try {
    const updateResponse = await CommodityModel.deleteOne({ commodityNumber });
    res.send({ code: 0, msg: "成功", content: updateResponse });
  } catch (err) {
    console.log(err);
    res.send({ code: -1, msg: "出错" });
  }
});

router.post("/setGoCourierNumber", (req, res) => {
  const { sallerId, orderNumber, courierNumber } = req.body;
  if (!sallerId || !orderNumber || !courierNumber) {
    res.send({ code: -1, msg: "参数为空" });
    return;
  }
  orderModel
    .findOneAndUpdate(
      { sallerId, orderNumber },
      { $set: { goCourierNumber: courierNumber, commodityStatus: 1 } }
    )
    .then((response) => {
      console.log(response);
      if (!response) {
        res.send({ code: -2, msg: "失败" });
        return;
      }
      res.send({ code: 0, msg: "订单快递单号更新成功" });
    })
    .catch((err) => {
      console.log(err);
      res.send({ code: -1, msg: "失败" });
    });
});

router.post("/handleReturnApply", (req, res) => {
  const { sallerId, orderNumber, isAgree } = req.body;
  const exit = Object.prototype.toString.call(isAgree) === "[object Boolean]";
  if (!sallerId || !orderNumber || !exit) {
    res.send({ code: -1, msg: "参数为空" });
    return;
  }
  orderModel
    .findOneAndUpdate(
      { sallerId, orderNumber },
      { $set: { commodityStatus: isAgree ? 5 : 4 } }
    )
    .then((response) => {
      console.log(response);
      if (!response) {
        res.send({ code: -2, msg: "失败" });
        return;
      }
      res.send({
        code: 0,
        msg: `已${isAgree ? "同意" : "拒绝"}订单 ${orderNumber} 的退货申请`,
      });
    })
    .catch((err) => {
      console.log(err);
      res.send({ code: -1, msg: "失败" });
    });
});
module.exports = router;
