import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import {User} from "./user.interface";

admin.initializeApp();

export const auth = functions.https.onRequest(async (req, res) => {
  functions.logger.info("Auth trigger", {structuredData: true});
  const db = admin.firestore();
  const {address} = req.query;

  const data = await db.collection("users")
      .where("address", "==", address)
      .get();

  let user: User = {id: "", address: address as string};

  if (data.empty) {
    user = await db.collection("users").add(user);
  }
  user.nonce = Math.floor(Math.random() * 10000000);
  await db.collection("users")
      .doc(user.id)
      .update({nonce: user.nonce, address: user.address});

  res.status(200).json(user);
});
