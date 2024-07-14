import express from "express";
import { MongoClient, ObjectId } from "mongodb";
import bodyParser from "body-parser";
import cors from "cors";
import Grid from "gridfs-stream";
import mongoose from "mongoose";
import pkg from "body-parser";
import Stripe from "stripe";
const { json } = pkg;
const app = express();
const port = 3000;
const uri =
  "mongodb+srv://alabdulmalikkhali:Dohaultimatetennis%40123@cluster0.y9wx8dx.mongodb.net/mydatabase?retryWrites=true&w=majority&appName=Cluster0";

// MongoDB client initialization with options
const client = new MongoClient(uri);
const dbName = "Tennis";

app.use(bodyParser.json({ limit: "50mb" }));
app.use(bodyParser.urlencoded({ limit: "50mb", extended: true }));
app.use(express.json());
// Set up CORS
const stripe = new Stripe(
  "sk_test_51PVaqNBZras4q9oYIOxggWWpcHuWbpayBqU1rkLqMees6x4BXdBkzkBji6M71OZTZ6NI4Dn0v22iCoKdJ7mfpzE500ChftJbTI"
);
const allowedOrigins = [
  "http://localhost:5173",
  "https://localhost:5173",
  "https://tennis-league-app-gold.vercel.app",
  "https://dohaultimatetennis.com",
  "https://e10db186-2d58-41de-bab4-3b002dc677ca-00-30obqzx780spv.pike.replit.dev",
]; // Replace with your actual client origin
app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
  })
);

async function connectToMongoDB() {
  try {
    await client.connect();
    console.log("\n\n\nConnected to MongoDB\n\n\n");
  } catch (error) {
    console.error("\n\n\nError connecting to MongoDB:", error);
  }
}
connectToMongoDB();

const conn = mongoose.createConnection(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

let gfs;
conn.once("open", () => {
  gfs = Grid(conn.db, mongoose.mongo);
  gfs.collection("uploads");
});

// API endpoint for user registration
const usersCollection = client.db("Tennis").collection("users");
app.use(json());
const db = client.db("Tennis");
// Routes
app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await usersCollection.findOne({
      $or: [{ email: email.toLowerCase() }, { email: email }],
      password: password,
    });
    if (user) {
      res.status(200).json({ data: user });
    } else {
      const userByEmail = await usersCollection.findOne({
        email: email.toLowerCase(),
      });
      console.log(userByEmail);
      res.status(401).json({ error: "Invalid credentials" });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});
app.get("/", (req, res) => {
  res.send("Welcome to Doha Tennis League App");
});
app.delete("/matches/:id", async (req, res) => {
  const id = req.params.id;
  if (!ObjectId.isValid(id)) {
    console.log(id);
    return res.status(400).json({ error: "Invalid ID format" });
  }

  try {
    const result = await db
      .collection("challengeNotifications")
      .deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: "Document not found" });
    }

    return res.status(200).json({ message: "Document deleted successfully" });
  } catch (err) {
    console.error("Error", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});
app.post("/register", async (req, res) => {
  const { email, password, name, profilePicture, Gender } = req.body;
  try {
    const db = client.db(dbName);
    const usersCollection = db.collection("users");

    const existingUser = await usersCollection.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: "User already exists" });
    }

    const userData = {
      email,
      password,
      name,
      profilePicture,
      Gender,
    };
    await usersCollection.insertOne(userData);
    console.log("New User Registered");
    res.status(201).json({ data: userData });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});
app.put("/players/:player", async (req, res) => {
  const { player } = req.params;
  const { points } = req.body;

  try {
    const findPlayer = await db.collection("users").findOne({ name: player });
    const foundPlayer = await db
      .collection("users")
      .findOneAndUpdate(
        { name: player },
        { $set: { points: (findPlayer.points || 0) + points } }
      );

    if (!foundPlayer) {
      return res.status(404).json({ message: "Player not found" });
    }
    // Send response
    return res
      .status(200)
      .json({ message: "Player points updated successfully" });
  } catch (error) {
    console.error("Error updating player points:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

app.post("/join-league", async (req, res) => {
  const { userName, division } = req.body;
  console.log(userName, division);
  try {
    const paymentSuccess = true;
    if (paymentSuccess) {
      const userUpdateResult = await db
        .collection("divisions")
        .findOneAndUpdate(
          { name: division },
          { $addToSet: { players: userName } }
        );
      console.log(userUpdateResult);
      res.status(200).json({ message: "User Joined Division" });
    } else {
      res.status(402).json({ error: "Payment failed" });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});
app.post("/create-payment-intent", async (req, res) => {
  try {
    const paymentIntent = await stripe.paymentIntents.create({
      currency: "USD",
      amount: 5000,
      automatic_payment_methods: { enabled: true },
    });
    console.log(paymentIntent.automatic_payment_methods);
    // Send publishable key and PaymentIntent details to client
    res.send({
      clientSecret: paymentIntent.client_secret,
    });
  } catch (e) {
    return res.status(400).send({
      error: {
        message: e.message,
      },
    });
  }
});
// Get league details
app.get("/league-details", async (req, res) => {
  try {
    const divisions = await db.collection("divisions").find({}).toArray();
    let leagueDetails = {
      fees: "$50",
      divisions: divisions,
    };
    res.status(200).json(leagueDetails);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get Leaderboard Logic
app.get("/leaderboard", async (req, res) => {
  try {
    // Fetch leaderboard data from the database
    const db = client.db(dbName);
    const leaderboard = await db.collection("leaderboard").find({}).toArray();
    res.status(200).json({ data: leaderboard });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});
// Admin Panel: Get Challenge Requests
app.get("/admin/challengeRequests", async (req, res) => {
  try {
    const requests = await db
      .collection("challengeNotifications")
      .find({})
      .toArray();
    res.status(200).json({ data: requests });
  } catch (error) {
    console.error("Error fetching challenge requests:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
app.put("/admin/updateMatchScore", async (req, res) => {
  const { matchId, player1Score, player2Score } = req.body;
  console.log(matchId, player1Score, player2Score);

  // Check for missing parameters
  if (!matchId || player1Score === undefined || player2Score === undefined) {
    console.log("Missing parameters:", { matchId, player1Score, player2Score });
    return res.status(400).json({ error: "Missing required parameters" });
  }

  try {
    const updateResult = await db
      .collection("challengeNotifications")
      .updateOne(
        { _id: new ObjectId(matchId) },
        { $set: { player1Score: player1Score, player2Score: player2Score } }
      );

    // Check if match was found and updated
    if (updateResult.modifiedCount === 0) {
      console.log("Match not found:", matchId);
      return res.status(404).json({ error: "Match not found" });
    }

    // Success response
    console.log("Match score updated successfully:", matchId);
    res.status(200).json({ message: "Match score updated successfully" });
  } catch (error) {
    // Error handling
    console.error("Error updating match score:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/sendChallengeNotification", async (req, res) => {
  const { challengerId, challengedId, status } = req.body;
  if (status == null || status == undefined) {
    status = "pending";
  }

  if (challengedId && challengerId && status != null) {
    try {
      const notification = {
        challengerId,
        challengedId,
        status: status,
        createdAt: new Date(),
      };

      await db.collection("challengeNotifications").insertOne(notification);

      res
        .status(200)
        .json({ message: "Challenge notification sent successfully" });
    } catch (error) {
      console.error("Error sending challenge notification:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  } else {
    console.log("Challenger ID: ", challengerId);
    console.log("Challenged ID: ", challengedId);
  }
});
app.post("/sendWalkOver", async (req, res) => {
  const { challengerId, challengedId, status } = req.body;
  if (status == null || status == undefined) {
    status = "walkover-pending";
  }

  if (challengedId && challengerId && status != "approved") {
    try {
      const notification = {
        challengerId,
        challengedId,
        status: status,
        createdAt: new Date(),
      };

      await db.collection("challengeNotifications").insertOne(notification);

      res
        .status(200)
        .json({ message: "Challenge notification sent successfully" });
    } catch (error) {
      console.error("Error sending challenge notification:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  } else {
    console.log("Challenger ID: ", challengerId);
    console.log("Status", status);
    console.log("Challenged ID: ", challengedId);
  }
});
// Admin Panel: Update Challenge Request Status
app.post("/admin/updateChallengeStatus", async (req, res) => {
  const { requestId, status } = req.body;
  try {
    console.log(requestId, status);
    await db
      .collection("challengeNotifications")
      .findOneAndUpdate(
        { _id: new ObjectId(requestId) },
        { $set: { status: status } }
      );
    res
      .status(200)
      .json({ message: "Challenge request status updated successfully" });
  } catch (error) {
    console.error("Error updating challenge request status:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
// Get Players Logic
app.get("/players", async (req, res) => {
  try {
    // Fetch player data from the database
    const db = client.db(dbName);
    const players = await db.collection("users").find({}).toArray();

    res.status(200).json({ data: players });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get Matches Logic
app.get("/matches", async (req, res) => {
  try {
    // Fetch match data from the database
    const db = client.db(dbName);
    const matches = await db.collection("matches").find({}).toArray();
    res.status(200).json({ data: matches });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});
app.get("/admin/reports", async (req, res) => {
  try {
    // Fetch approved challenge notifications from the database
    const db = client.db(dbName);
    const approvedChallenges = await db
      .collection("challengeNotifications")
      .find({ status: "approved" })
      .toArray();

    res.status(200).json({ data: approvedChallenges });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Report Match Result Logic
app.post("/matches/:matchId/report", async (req, res) => {
  const matchId = req.params.matchId;
  const result = req.body.result;
  try {
    // Update match result in the database
    const db = client.db(dbName);
    const match = await db
      .collection("matches")
      .findOneAndUpdate(
        { _id: matchId },
        { $set: { result: result } },
        { returnOriginal: false }
      );
    res.status(200).json({ data: match.value });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Admin functionalities

// Get Admin Divisions Logic
app.get("/divisions", async (req, res) => {
  try {
    // Fetch admin divisions from the database
    const db = client.db(dbName);
    const divisions = await db.collection("divisions").find({}).toArray();
    res.status(200).json({ data: divisions });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Add Division Logic
app.post("/admin/divisions/:name", async (req, res) => {
  const divisionName = req.params.name;
  const divisionDescription = req.body.description;
  try {
    const db = client.db(dbName);
    const result = await db
      .collection("divisions")
      .insertOne({ name: divisionName, description: divisionDescription });
    res.status(201).json({ data: result.insertedId });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Delete Division Logic
app.delete("/admin/divisions/:id", async (req, res) => {
  const divisionId = req.params.id;
  console.log(divisionId);
  try {
    // Delete the division from the database
    const db = client.db(dbName);
    const result = await db
      .collection("divisions")
      .findOneAndDelete({ _id: new ObjectId(divisionId) });
    res.status(200);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get Admin Matches Logic
app.get("/admin/matches", async (req, res) => {
  try {
    // Fetch admin matches from the database
    const db = client.db(dbName);
    const matches = await db.collection("adminMatches").find({}).toArray();
    res.status(200).json({ data: matches });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Edit Match Score Logic
app.put("/admin/matches/:matchId", async (req, res) => {
  const matchId = req.params.matchId;
  const scores = req.body.scores;
  try {
    // Update match scores in the database
    const db = client.db(dbName);
    const match = await db
      .collection("adminMatches")
      .findOneAndUpdate(
        { _id: matchId },
        { $set: { scores: scores } },
        { returnOriginal: false }
      );
    res.status(200).json({ data: match.value });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get Player Requests Logic
app.get("/admin/player-requests", async (req, res) => {
  try {
    // Fetch player requests from the database
    const db = client.db(dbName);
    const requests = await db.collection("playerRequests").find({}).toArray();
    res.status(200).json({ data: requests });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Approve Player Request Logic
app.put("/admin/player-requests/approve", async (req, res) => {
  const requestId = req.params.id;
  try {
    // Update player request status to approved in the database
    const db = client.db(dbName);
    const request = await db
      .collection("playerRequests")
      .findOneAndUpdate(
        { _id: requestId },
        { $set: { status: "approved" } },
        { returnOriginal: false }
      );
    res.status(200).json({ data: request.value });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Reject Player Request Logic
app.put("/admin/player-requests/reject", async (req, res) => {
  const requestId = req.params.id;
  try {
    // Update player request status to rejected in the database
    const db = client.db(dbName);
    const request = await db
      .collection("playerRequests")
      .findOneAndUpdate(
        { _id: requestId },
        { $set: { status: "rejected" } },
        { returnOriginal: false }
      );
    res.status(200).json({ data: request.value });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
