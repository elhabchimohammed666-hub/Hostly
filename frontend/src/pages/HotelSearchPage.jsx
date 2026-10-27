import { useEffect, useState } from "react";
import "./HotelSearchPage.css";

const initialSearch = {
  destination: "",
  checkIn: "",
  checkOut: "",
  adults: "2",
  children: "0",
  rooms: "1",
};

function HotelSearchPage() {
  const [form, setForm] = useState(initialSearch);
  const [search, setSearch] = useState(null);
  const [page, setPage] = useState(1);
  const [results, setResults] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!search) {
      return undefined;
    }

    const controller = new AbortController();
    const params = new URLSearchParams({ ...search, page: String(page) });

    const loadHotels = async () => {
      setLoading(true);
      setError("");

      try {
        const response = await fetch(`/api/hotels/search?${params}`, {
          signal: controller.signal,
        });
        const body = await response.json();

        if (!response.ok || !body.success) {
          throw new Error(body.message || "La recherche n'a pas abouti.");
        }

        setResults(body.data.hotels);
        setPagination(body.data.pagination);
      } catch (requestError) {
        if (requestError.name !== "AbortError") {
          setError(requestError.message || "Une erreur est survenue pendant la recherche.");
          setResults([]);
          setPagination(null);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    loadHotels();
    return () => controller.abort();
  }, [search, page]);

  const updateForm = (event) => {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  };

  const submitSearch = (event) => {
    event.preventDefault();
    setPage(1);
    setSearch({ ...form });
  };

  return (
    <main className="hotel-search">
      <header className="hotel-search__intro">
        <p className="hotel-search__eyebrow">Votre prochain séjour</p>
        <h1>Trouvez l'hôtel qui vous ressemble</h1>
        <p>Comparez les hébergements disponibles pour vos dates de voyage.</p>
      </header>

      <form className="hotel-search__form" onSubmit={submitSearch}>
        <label>
          Destination
          <input
            autoComplete="address-level2"
            name="destination"
            onChange={updateForm}
            placeholder="Ville ou pays"
            required
            value={form.destination}
          />
        </label>
        <label>
          Arrivée
          <input
            name="checkIn"
            onChange={updateForm}
            required
            type="date"
            value={form.checkIn}
          />
        </label>
        <label>
          Départ
          <input
            min={form.checkIn || undefined}
            name="checkOut"
            onChange={updateForm}
            required
            type="date"
            value={form.checkOut}
          />
        </label>
        <label>
          Adultes
          <input
            min="1"
            name="adults"
            onChange={updateForm}
            required
            type="number"
            value={form.adults}
          />
        </label>
        <label>
          Enfants
          <input
            min="0"
            name="children"
            onChange={updateForm}
            type="number"
            value={form.children}
          />
        </label>
        <label>
          Chambres
          <input
            min="1"
            name="rooms"
            onChange={updateForm}
            required
            type="number"
            value={form.rooms}
          />
        </label>
        <button className="hotel-search__submit" type="submit">
          Rechercher
        </button>
      </form>

      <section aria-live="polite" className="hotel-search__results">
        {loading && <p role="status">Recherche des hôtels disponibles…</p>}
        {error && <p className="hotel-search__error" role="alert">{error}</p>}
        {!loading && !error && search && results.length === 0 && (
          <p>Aucun hôtel disponible pour ces critères. Essayez d'autres dates ou une autre destination.</p>
        )}

        {results.map((hotel) => (
          <article className="hotel-card" key={hotel._id}>
            {hotel.images?.[0]?.url && (
              <img
                alt={hotel.images[0].alt || hotel.name}
                className="hotel-card__image"
                src={hotel.images[0].url}
              />
            )}
            <div className="hotel-card__content">
              <p className="hotel-card__location">
                {hotel.location.city}, {hotel.location.country}
              </p>
              <h2>{hotel.name}</h2>
              <p className="hotel-card__description">{hotel.description}</p>
              <p>
                {(hotel.ratingAverage ?? 0).toFixed(1)} / 5
                {hotel.reviewCount > 0 && ` · ${hotel.reviewCount} avis`}
              </p>
              <p className="hotel-card__price">
                Dès {hotel.fromPrice} {hotel.currency} / nuit
              </p>
            </div>
          </article>
        ))}

        {pagination && pagination.pages > 1 && (
          <nav aria-label="Pagination des résultats" className="hotel-search__pagination">
            <button
              disabled={page <= 1 || loading}
              onClick={() => setPage((current) => current - 1)}
              type="button"
            >
              Précédent
            </button>
            <span>
              Page {pagination.page} sur {pagination.pages}
            </span>
            <button
              disabled={page >= pagination.pages || loading}
              onClick={() => setPage((current) => current + 1)}
              type="button"
            >
              Suivant
            </button>
          </nav>
        )}
      </section>
    </main>
  );
}

export default HotelSearchPage;
