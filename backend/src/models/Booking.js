import mongoose from "mongoose";

const pricingSchema = new mongoose.Schema(
  {
    nightlyRate: { type: Number, required: true, min: 0 },
    nights: { type: Number, required: true, min: 1, validate: Number.isInteger },
    subtotal: { type: Number, required: true, min: 0 },
    fees: { type: Number, default: 0, min: 0 },
    total: { type: Number, required: true, min: 0 },
    currency: {
      type: String,
      required: true,
      uppercase: true,
      match: /^[A-Z]{3}$/,
    },
  },
  { _id: false }
);

const guestsSchema = new mongoose.Schema(
  {
    adults: { type: Number, required: true, min: 1 },
    children: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

const bookingSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    hotel: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hotel",
      required: true,
    },
    room: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Room",
      required: true,
    },
    checkIn: {
      type: Date,
      required: true,
    },
    checkOut: {
      type: Date,
      required: true,
      validate: {
        validator(value) {
          return this.checkIn && value > this.checkIn;
        },
        message: "La date de départ doit être postérieure à la date d'arrivée.",
      },
    },
    guests: {
      type: guestsSchema,
      required: true,
    },
    roomsCount: {
      type: Number,
      default: 1,
      min: 1,
      validate: Number.isInteger,
    },
    pricing: {
      type: pricingSchema,
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "confirmed", "cancelled", "completed"],
      default: "pending",
      required: true,
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed", "refunded"],
      default: "pending",
      required: true,
    },
    paymentProviderReference: {
      type: String,
      trim: true,
      maxlength: 200,
    },
    cancelledAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

bookingSchema.index({ user: 1, checkIn: -1 });
bookingSchema.index({ hotel: 1, status: 1, checkIn: 1 });
bookingSchema.index({ room: 1, status: 1, checkIn: 1, checkOut: 1 });

const Booking = mongoose.models.Booking || mongoose.model("Booking", bookingSchema);

export default Booking;
