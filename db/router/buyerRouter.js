const express = require("express");
const router = express.Router();
const BuyerModel = require("@model/buyerModel");
const SallerModel = require("@model/sallerModel");
const VerificationCodeModel = require("@model/verificationCodeModel");
const CommodityModel = require("@model/commodityModel");
const CartModel = require("@model/cartModel");
const updateVerificationCode = require("@utils/updateVerificationCode");
const loginCookie = require("@utils/loginCookie");
const buyerUtils = require("./buyerUtils");

global.verificationCodeData = {};

router.post("/login", (req, res) => {
  const { loginNumber, passWord } = req.body;
  if (!loginNumber || !passWord) {
    res.send({ code: -1, msg: "参数为空" });
    return;
  }
  BuyerModel.find({
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
      const loginToken = await loginCookie.getLoginCookie(loginNumber, 1);

      updateVerificationCode(loginNumber, "", -1).then(() => {
        res.cookie("token", loginToken, { path: "/" });
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
  if (!loginNumber) {
    res.send({ code: -1, msg: "参数为空" });
    return;
  }
  BuyerModel.find({
    $or: [
      {
        loginNumber,
      },
      {
        mailBox: loginNumber,
      },
    ],
  })
    .then((response) => {
      console.log("退出");
      console.log("response");
      console.log(response);
      if (!response.length) {
        res.send({ code: -2, msg: "退出失败" });
        return;
      }
      res.clearCookie("token", { path: "/" });
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
    buyerName,
    passWord,
    mailBox,
  } = req.body;
  if (
    !loginNumber ||
    !passWord ||
    !buyerName ||
    !mailBox ||
    !verificationCode
  ) {
    res.send({ code: -1, msg: "参数为空" });
    return;
  }
  try {
    const findMailBox = await BuyerModel.find({
      mailBox,
    });
    if (findMailBox.length) {
      res.send({ code: -2, msg: "此邮箱已被注册，请找回密码" });
      return;
    }
    const findLoginNumber = await BuyerModel.find({
      loginNumber,
    });
    if (findLoginNumber.length) {
      res.send({ code: -2, msg: "此账号已存在，请找回密码" });
      return;
    }

    VerificationCodeModel.find({ mailBox }).then((response) => {
      if (!response.length) {
        res.send({ code: -2, msg: "邮箱验证码不正确" });
        return;
      }
      const { codeNumber, time } = response[0];

      if (codeNumber !== verificationCode) {
        res.send({ code: -2, msg: "邮箱验证码不正确" });
      } else if (Date.now() - time >= 300000) {
        res.send({ code: -2, msg: "邮箱验证码失效" });
      } else {
        BuyerModel.insertMany({ loginNumber, passWord, buyerName, mailBox })
          .then(async () => {
            const loginToken = await loginCookie.getLoginCookie(loginNumber, 1);
            res.cookie("token", loginToken, { path: "/" });
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

router.post("/getCart", async (req, res) => {
  const { buyerId } = req.body;
  if (!buyerId) {
    res.send({ code: -1, msg: "参数为空" });
    return;
  }
  try {
    CartModel.find({ buyerId })
      .then((response) => {
        res.send({ code: 0, msg: "查询成功", content: response });
      })
      .catch((err) => {
        console.log(err);
        res.send({ code: -2, msg: "查询失败" });
      });
  } catch (err) {
    console.log(err);
    res.send({ code: -1, msg: "查询失败" });
  }
});

router.post("/addCart", async (req, res) => {
  const { buyerId, commodityNumber, sallerId } = req.body;
  if (!buyerId || !commodityNumber || !sallerId) {
    res.send({ code: -1, msg: "参数为空" });
    return;
  }
  try {
    const cartfindResp = CartModel.find({ commodityNumber });
    if (!!cartfindResp.length) {
      const updateResp = await CartModel.findByIdAndUpdate(
        cartfindResp[0]._id,
        {
          $set: {
            updateTime: Date.now(),
            commodityCount: cartfindResp[0].commodityCount - 1,
            commodityTotalValue:
              (cartfindResp[0].commodityCount - 1) *
              cartfindResp[0].memberValue,
          },
        }
      );
      res.send({ code: 0, msg: "添加成功", content: updateResp[0] });
      return;
    }
    const obj = {};
    const commodityResponse = await CommodityModel.find({ commodityNumber });
    if (!commodityResponse.length) {
      res.send({ code: 0, msg: "没有该商品" });
      return;
    }
    obj.commodityNumber = commodityNumber;
    obj.commodityCount = 1;
    obj.commodityName = commodityResponse[0].commodityName;
    obj.commodityImgUrl = commodityResponse[0].commodityImgUrl;
    obj.introduction = commodityResponse[0].introduction;
    obj.marketValue = commodityResponse[0].marketValue;
    obj.memberValue = commodityResponse[0].memberValue;
    obj.classificationNumber = commodityResponse[0].classificationNumber;
    obj.classificationName = commodityResponse[0].classificationName;
    obj.commodityTotalValue = obj.commodityCount * obj.memberValue;

    const sallerResponse = await SallerModel.findById(sallerId);
    if (!sallerResponse) {
      res.send({ code: 0, msg: "没有该商家" });
      return;
    }
    obj.sallerId = sallerId;
    obj.sallerName = sallerResponse.sallerName;
    obj.sallerPhone = sallerResponse.sallerPhone;
    obj.update = Date.now();
    const cartResponse = await CartModel.find();
    obj.cartNumber = `${cartResponse.length}`;

    console.log("Object.keys(obj).length");
    console.log(Object.keys(obj).length);
    CartModel.insertMany(obj)
      .then((response) => {
        res.send({ code: 0, msg: "添加成功", content: response });
      })
      .catch((err) => {
        console.log(err);
        res.send({ code: -2, msg: "添加失败" });
      });
  } catch (err) {
    console.log(err);
    res.send({ code: -1, msg: "添加失败" });
  }
});

router.post("/deleteCart", async (req, res) => {
  const { cardNumber } = req.body;
  if (!cardNumber) {
    res.send({ code: -1, msg: "参数为空" });
    return;
  }
  try {
    CartModel.deleteOne({ cartNumber })
      .then(() => {
        res.send({ code: 0, msg: "删除成功" });
      })
      .catch((err) => {
        console.log(err);
        res.send({ code: -2, msg: "删除失败" });
      });
  } catch (err) {
    console.log(err);
    res.send({ code: -1, msg: "删除失败" });
  }
});

router.get("/getCommodity", async (req, res) => {
  const { classificationNumber } = req.query;
  if (!classificationNumber) {
    res.send({ code: -1, msg: "参数为空" });
    return;
  }
  try {
    if (classificationNumber != -1) {
      const findObj = {
        classificationNumber,
      };
      CommodityModel.find(findObj)
        .then((response) => {
          const resData = buyerUtils.handleCommodity(response);
          res.send({ code: 0, msg: "查询成功", content: resData });
        })
        .catch((err) => {
          console.log(err);
          res.send({ code: -2, msg: "查询失败" });
        });
      return;
    }
    CommodityModel.find()
      .then((response) => {
        const resData = buyerUtils.handleCommodity(response);
        res.send({ code: 0, msg: "查询成功", content: resData });
      })
      .catch((err) => {
        console.log(err);
        res.send({ code: -2, msg: "查询失败" });
      });
  } catch (err) {
    console.log(err);
    res.send({ code: -1, msg: "查询失败" });
  }
});

router.get("/getClassification", async (req, res) => {
  try {
    CommodityModel.find()
      .then((response) => {
        const resData = buyerUtils.getClassification(response);
        res.send({ code: 0, msg: "查询成功", content: resData });
      })
      .catch((err) => {
        console.log(err);
        res.send({ code: -2, msg: "查询失败" });
      });
  } catch (err) {
    console.log(err);
    res.send({ code: -1, msg: "查询失败" });
  }
});

module.exports = router;
