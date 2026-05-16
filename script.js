const searchInput = document.getElementById("country-input");
const searchButton = document.getElementById("search-btn");
const resultsDiv = document.getElementById("results");
const personalBtn = document.getElementById("personal-details-btn");
const personalModal = document.getElementById("personalModal");
const closeModalBtn = document.getElementById("closeModal");
const favoritesList = document.getElementById("favorites-list");
const recentSearchesList = document.getElementById("recent-searches-list");
const recentSearchesSection = document.getElementById("recent-searches-section");
const themeToggle = document.getElementById("theme-toggle");

// Used to ignore stale API responses when user clears/starts a new search
let requestToken = 0;

// ---------------- Dark Mode (localStorage) ----------------
const THEME_KEY = "countryExplorerTheme";

function getTheme() {
  return localStorage.getItem(THEME_KEY) || "light";
}

function setTheme(theme) {
  localStorage.setItem(THEME_KEY, theme);
  applyTheme();
}

function applyTheme() {
  const theme = getTheme();
  const isDark = theme === "dark";
  document.body.classList.toggle("dark-theme", isDark);
  if (themeToggle) {
    themeToggle.textContent = isDark ? "☀️" : "🌙";
    themeToggle.setAttribute("aria-label", isDark ? "Switch to light mode" : "Switch to dark mode");
    themeToggle.title = isDark ? "Light mode" : "Dark mode";
  }
}

if (themeToggle) {
  themeToggle.addEventListener("click", () => {
    const next = getTheme() === "dark" ? "light" : "dark";
    setTheme(next);
  });
}

applyTheme();

renderFavoritesList();
renderSearchHistory();

searchButton.addEventListener("click", () => {
  const value = searchInput.value.trim();

  if (value === "") {
    alert("Please enter a country name.");
    return;
  }

  fetchCountry(value);
});

searchInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") searchButton.click();
});

// When input is empty (keyboard / backspace / iOS native X) → clear results
searchInput.addEventListener("input", () => {
  if (searchInput.value.trim() === "") {
    requestToken++;
    if (resultsDiv) resultsDiv.innerHTML = "";
    hideRecentSearches();
  }
});

function showPersonalDetails() {
  if (personalModal) {
    personalModal.classList.remove("hidden");
    personalModal.setAttribute("aria-hidden", "false");
  }
}

function hidePersonalModal() {
  if (personalModal) {
    personalModal.classList.add("hidden");
    personalModal.setAttribute("aria-hidden", "true");
  }
}

if (personalBtn) personalBtn.addEventListener("click", showPersonalDetails);

if (closeModalBtn) closeModalBtn.addEventListener("click", hidePersonalModal);

window.addEventListener("click", (e) => {
  if (e.target === personalModal) hidePersonalModal();
});

// Favorites: click on star -> add/remove; click on favorite item -> open country
if (resultsDiv) {
  resultsDiv.addEventListener("click", (e) => {
    const btn = e.target.closest(".btn-favorite");
    if (!btn) return;
    e.preventDefault();
    const cca2 = btn.dataset.cca2;
    const country = cca2 ? renderedCountryByCca2[cca2] : null;
    if (isFavorite(cca2)) {
      removeFromFavorites(cca2);
      if (country) renderCountry(country);
    } else if (country) {
      addToFavorites(country);
      renderCountry(country);
    }
  });
}

if (favoritesList) {
  favoritesList.addEventListener("click", (e) => {
    const btn = e.target.closest(".favorite-item");
    if (!btn) return;
    fetchByCode(btn.dataset.cca2);
  });
}

// Delete recent item on mousedown (fires before input blur)
if (recentSearchesList) {
  recentSearchesList.addEventListener("mousedown", (e) => {
    const removeBtn = e.target.closest(".recent-search-remove");
    if (!removeBtn) return;

    e.preventDefault();
    e.stopPropagation();

    const encoded = removeBtn.dataset.query;
    const query = encoded ? decodeURIComponent(encoded) : "";
    if (query) removeFromSearchHistory(query);
  });
}

// Open recent item على الضغط (pointerdown يمسك قبل blur فالقائمة ما تنغلق قبل التنفيذ)
if (recentSearchesList) {
  recentSearchesList.addEventListener("pointerdown", (e) => {
    if (e.target.closest(".recent-search-remove")) return;
    const btn = e.target.closest(".recent-search-item");
    if (!btn) return;
    e.preventDefault();
    const encodedQuery = btn.dataset.query;
    const query = encodedQuery ? decodeURIComponent(encodedQuery) : btn.textContent.trim();
    if (query) {
      fetchCountry(query);
      hideRecentSearches();
    }
  });
}

let recentSearchesHideTimer = null;

function showRecentSearches() {
  if (recentSearchesSection) {
    if (recentSearchesHideTimer) clearTimeout(recentSearchesHideTimer);
    recentSearchesSection.classList.add("is-visible");
  }
}

function hideRecentSearches() {
  if (!recentSearchesSection) return;
  if (recentSearchesHideTimer) clearTimeout(recentSearchesHideTimer);
  recentSearchesHideTimer = setTimeout(() => {
    recentSearchesSection.classList.remove("is-visible");
    recentSearchesHideTimer = null;
  }, 200);
}

if (searchInput) {
  searchInput.addEventListener("focus", showRecentSearches);
  searchInput.addEventListener("blur", hideRecentSearches);
}

// ---------------- Search History (localStorage) ----------------

const SEARCH_HISTORY_KEY = "countryExplorerSearchHistory";
const SEARCH_HISTORY_MAX = 10;

function getSearchHistory() {
  try {
    const raw = localStorage.getItem(SEARCH_HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function addToSearchHistory(query) {
  if (!query || !query.trim()) return;
  const q = query.trim();
  let list = getSearchHistory().filter((item) => item !== q);
  list.unshift(q);
  list = list.slice(0, SEARCH_HISTORY_MAX);
  localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(list));
  renderSearchHistory();
}

function removeFromSearchHistory(query) {
  const normalized = query.trim();
  const list = getSearchHistory().filter((item) => item.trim() !== normalized);
  localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(list));
  renderSearchHistory();
}

function clearSearchHistory() {
  localStorage.removeItem(SEARCH_HISTORY_KEY);
  renderSearchHistory();
}

function renderSearchHistory() {
  if (!recentSearchesList) return;
  const list = getSearchHistory();
  if (list.length === 0) {
    recentSearchesList.innerHTML = `<p class="recent-searches-empty">—</p>`;
    return;
  }
  recentSearchesList.innerHTML = list
    .map(
      (q) =>
        `<span class="recent-search-item-wrap">
          <button type="button" class="recent-search-item" data-query="${encodeURIComponent(
            q
          )}">${q}</button>
          <button type="button" class="recent-search-remove" data-query="${encodeURIComponent(
            q
          )}" title="Remove">×</button>
        </span>`
    )
    .join("");
}

// ---------------- Favorites (localStorage + State) ----------------

const FAVORITES_KEY = "countryExplorerFavorites";
const renderedCountryByCca2 = {};

function getFavorites() {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveFavorites(arr) {
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(arr));
  renderFavoritesList();
}

function isFavorite(cca2) {
  return getFavorites().some((f) => f.cca2 === cca2);
}

function addToFavorites(country) {
  const cca2 = country.cca2;
  if (!cca2) return;
  const list = getFavorites();
  if (list.some((f) => f.cca2 === cca2)) return;
  list.push({
    cca2,
    name: country.name?.common || "Unknown",
    flag: country.flags?.png || "",
  });
  saveFavorites(list);
}

function removeFromFavorites(cca2) {
  saveFavorites(getFavorites().filter((f) => f.cca2 !== cca2));
}

function renderFavoritesList() {
  if (!favoritesList) return;
  const list = getFavorites();
  if (list.length === 0) {
    favoritesList.innerHTML = `<p class="favorites-empty">—</p>`;
    return;
  }
  favoritesList.innerHTML = list
    .map(
      (f) => `
    <button type="button" class="favorite-item" data-cca2="${f.cca2}" title="${f.name}">
      <img src="${f.flag}" alt="" />
      <span>${f.name}</span>
    </button>
  `
    )
    .join("");
}

async function fetchByCode(cca2) {
  resultsDiv.innerHTML = "<p>🔄 Loading country data...</p>";
  try {
    const res = await fetch(`https://restcountries.com/v3.1/alpha/${encodeURIComponent(cca2)}`);
    if (!res.ok) throw new Error("Country not found. Please try again.");
    const data = await res.json();
    if (!data || !data.length) throw new Error("Country not found. Please try again.");
    renderCountry(data[0]);
  } catch (err) {
    resultsDiv.innerHTML = `<p class="error-message">❌ ${err.message}</p>`;
  }
}

// ---------------- API ----------------

async function fetchCountry(countryName) {
  const myToken = ++requestToken;
  const query = countryName.trim();

  resultsDiv.innerHTML = "<p>🔄 Loading country data...</p>";

  try {
    const res = await fetch(
      `https://restcountries.com/v3.1/name/${encodeURIComponent(query)}`
    );

    if (myToken !== requestToken) return;
    if (!res.ok) throw new Error("Country not found. Please try again.");

    const data = await res.json();
    if (myToken !== requestToken) return;
    if (!data || !data.length) throw new Error("Country not found. Please try again.");

    addToSearchHistory(query);
    if (myToken !== requestToken) return;

    renderCountry(data[0]);
  } catch (err) {
    if (myToken !== requestToken) return;
    resultsDiv.innerHTML = `<p class="error-message">❌ ${err.message}</p>`;
  }
}

function renderCountry(country) {
  if (country.cca2) renderedCountryByCca2[country.cca2] = country;

  const flag = country.flags?.png || "";
  const isFav = isFavorite(country.cca2);
  const starLabel = isFav ? "Remove from Favorites" : "Add to Favorites";
  const starClass = "btn-favorite " + (isFav ? "btn-favorite-on" : "");

  const name = country.name?.common || "Unknown";
  const capital = country.capital?.[0] || "N/A";
  const region = country.region || "N/A";
  const population =
    country.population != null ? country.population.toLocaleString() : "N/A";
  const languages = country.languages
    ? Object.values(country.languages).join(", ")
    : "N/A";
  const currencies = country.currencies
    ? Object.values(country.currencies)
        .map((c) => c.name)
        .join(", ")
    : "N/A";

  resultsDiv.innerHTML = `
    <div class="country-card">
      <button type="button" class="${starClass}" data-cca2="${country.cca2 || ""}" title="${starLabel}" aria-label="${starLabel}">⭐</button>
      <img src="${flag}" alt="Flag of ${name}" />
      <h2>${name}</h2>
      <p><strong>Capital:</strong> ${capital}</p>
      <p><strong>Region:</strong> ${region}</p>
      <p><strong>Population:</strong> ${population}</p>
      <p><strong>Languages:</strong> ${languages}</p>
      <p><strong>Currencies:</strong> ${currencies}</p>
    </div>
  `;
}