import Booking from "../models/Booking.js";
import Hotel from "../models/Hotel.js";
import Room from "../models/Room.js";

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const parseDate = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) {
    return null;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value
    ? null
    : date;
};

const parsePositiveInteger = (value, fallback, maximum = Number.MAX_SAFE_INTEGER) => {
  if (value === undefined) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= maximum
    ? parsed
    : null;
};

const parseAmenities = (value) => {
  const values = Array.isArray(value) ? value : [value];
  return values
    .filter((item) => typeof item === "string")
    .flatMap((item) => item.split(","))
    .map((item) => item.trim())
    .filter(Boolean);
};

export const searchHotels = async (req, res, next) => {
  try {
    const {
      destination,
      checkIn: checkInValue,
      checkOut: checkOutValue,
      roomType,
      roomAmenity,
      minPrice: minPriceValue,
      maxPrice: maxPriceValue,
      minRating: minRatingValue,
    } = req.query;

    const checkIn = parseDate(checkInValue);
    const checkOut = parseDate(checkOutValue);

    if (typeof destination !== "string" || !destination.trim()) {
      return res.status(400).json({
        success: false,
        message: "La destination est obligatoire.",
      });
    }

    if (!checkIn || !checkOut || checkOut <= checkIn) {
      return res.status(400).json({
        success: false,
        message: "Fournissez des dates valides ; le départ doit suivre l'arrivée.",
      });
    }

    if (checkIn < new Date(new Date().toISOString().slice(0, 10))) {
      return res.status(400).json({
        success: false,
        message: "La date d'arrivée ne peut pas être dans le passé.",
      });
    }

    const adults = parsePositiveInteger(req.query.adults, 1, 30);
    const children = parsePositiveInteger(req.query.children, 0, 30);
    const roomsCount = parsePositiveInteger(req.query.rooms, 1, 20);
    const page = parsePositiveInteger(req.query.page, 1);
    const limit = parsePositiveInteger(req.query.limit, 12, 50);
    const minRating = minRatingValue === undefined ? 0 : Number(minRatingValue);
    const minPrice = minPriceValue === undefined ? undefined : Number(minPriceValue);
    const maxPrice = maxPriceValue === undefined ? undefined : Number(maxPriceValue);

    if (
      adults === null ||
      adults < 1 ||
      children === null ||
      roomsCount === null ||
      roomsCount < 1 ||
      page === null ||
      page < 1 ||
      limit === null ||
      limit < 1 ||
      !Number.isFinite(minRating) ||
      minRating < 0 ||
      minRating > 5 ||
      (minPrice !== undefined && (!Number.isFinite(minPrice) || minPrice < 0)) ||
      (maxPrice !== undefined && (!Number.isFinite(maxPrice) || maxPrice < 0)) ||
      (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice)
    ) {
      return res.status(400).json({
        success: false,
        message: "Un ou plusieurs filtres de recherche sont invalides.",
      });
    }

    const validRoomTypes = ["standard", "deluxe", "suite", "other"];
    if (roomType !== undefined && !validRoomTypes.includes(roomType)) {
      return res.status(400).json({
        success: false,
        message: "Le type de chambre demandé est invalide.",
      });
    }

    const hotelFilter = {
      status: "published",
      ratingAverage: { $gte: minRating },
      $or: [
        { "location.city": { $regex: escapeRegex(destination.trim()), $options: "i" } },
        { "location.country": { $regex: escapeRegex(destination.trim()), $options: "i" } },
      ],
    };

    const hotelAmenities = parseAmenities(req.query.amenity);
    if (hotelAmenities.length) {
      hotelFilter.amenities = { $all: hotelAmenities };
    }

    const [hotels, matchingRooms] = await Promise.all([
      Hotel.find(hotelFilter).lean(),
      Room.find({
        isActive: true,
        ...(roomType ? { type: roomType } : {}),
        ...(minPrice !== undefined || maxPrice !== undefined
          ? {
              pricePerNight: {
                ...(minPrice !== undefined ? { $gte: minPrice } : {}),
                ...(maxPrice !== undefined ? { $lte: maxPrice } : {}),
              },
            }
          : {}),
        ...(parseAmenities(roomAmenity).length
          ? { amenities: { $all: parseAmenities(roomAmenity) } }
          : {}),
      }).lean(),
    ]);

    if (!hotels.length || !matchingRooms.length) {
      return res.json({
        success: true,
        data: {
          hotels: [],
          pagination: { page, limit, total: 0, pages: 0 },
        },
      });
    }

    const hotelsById = new Map(hotels.map((hotel) => [String(hotel._id), hotel]));
    const rooms = matchingRooms.filter((room) => {
      if (!hotelsById.has(String(room.hotel))) {
        return false;
      }

      return (
        room.capacity.adults >= Math.ceil(adults / roomsCount) &&
        room.capacity.children >= Math.ceil(children / roomsCount)
      );
    });

    const roomIds = rooms.map((room) => room._id);
    const bookings = roomIds.length
      ? await Booking.find({
          room: { $in: roomIds },
          status: { $in: ["pending", "confirmed"] },
          checkIn: { $lt: checkOut },
          checkOut: { $gt: checkIn },
        })
          .select("room roomsCount")
          .lean()
      : [];

    const bookedUnitsByRoom = new Map();
    for (const booking of bookings) {
      const roomId = String(booking.room);
      bookedUnitsByRoom.set(
        roomId,
        (bookedUnitsByRoom.get(roomId) || 0) + (booking.roomsCount || 1)
      );
    }

    const availableRoomsByHotel = new Map();
    for (const room of rooms) {
      const availableUnits =
        room.totalUnits - (bookedUnitsByRoom.get(String(room._id)) || 0);
      if (availableUnits < roomsCount) {
        continue;
      }

      const hotelId = String(room.hotel);
      const hotelRooms = availableRoomsByHotel.get(hotelId) || [];
      hotelRooms.push({
        ...room,
        availableUnits,
      });
      availableRoomsByHotel.set(hotelId, hotelRooms);
    }

    const results = [...availableRoomsByHotel.entries()]
      .map(([hotelId, availableRooms]) => {
        const hotel = hotelsById.get(hotelId);
        const fromPrice = Math.min(...availableRooms.map((room) => room.pricePerNight));
        return {
          ...hotel,
          availableRooms,
          fromPrice,
          currency: availableRooms.find((room) => room.pricePerNight === fromPrice).currency,
        };
      })
      .sort((a, b) => a.fromPrice - b.fromPrice);

    const total = results.length;
    const start = (page - 1) * limit;

    return res.json({
      success: true,
      data: {
        hotels: results.slice(start, start + limit),
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    return next(error);
  }
};
