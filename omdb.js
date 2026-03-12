const apiKey = '5e5feec5';

document.addEventListener("DOMContentLoaded", () => {
  console.log("CineScope JS Loaded!");

  // DOM elements
  const searchInput = document.getElementById("search");
  const searchBtn = document.getElementById("search-btn");
  const results = document.getElementById("results");
  const spinner = document.getElementById("spinner");
  const modal = document.getElementById("modal");
  const modalBody = document.getElementById("modal-body");
  const closeModal = document.getElementById("close-modal");
  const sortSelect = document.getElementById("sort-options");
  const clearCacheBtn = document.getElementById("clear-cache");
  const darkModeBtn = document.getElementById("toggle-dark");
  const watchlistBtn = document.getElementById("view-watchlist");
  const autocompleteBox = document.getElementById("autocomplete");
  const recentlyViewed = document.getElementById("recently-viewed");

  let currentQuery = "";
  let currentPage = 1;
  let loading = false;

  const placeholder = "https://via.placeholder.com/300x450?text=No+Image";

  /* -------------------------------------------
     CACHE FUNCTIONS
  ------------------------------------------- */
  function saveCache(key, data) {
    localStorage.setItem(key, JSON.stringify({
      timestamp: Date.now(),
      data
    }));
  }

  function loadCache(key) {
    const cached = localStorage.getItem(key);
    if (!cached) return null;

    const parsed = JSON.parse(cached);
    const week = 7 * 24 * 60 * 60 * 1000;

    if (Date.now() - parsed.timestamp > week) {
      localStorage.removeItem(key);
      return null;
    }

    return parsed.data;
  }

  function showSpinner() { spinner.style.display = "block"; }
  function hideSpinner() { spinner.style.display = "none"; }

  /* -------------------------------------------
     AUTOCOMPLETE
  ------------------------------------------- */
  async function updateAutocomplete(query) {
    if (query.length < 2) {
      autocompleteBox.style.display = "none";
      return;
    }

    const url = `https://www.omdbapi.com/?apikey=${apiKey}&s=${query}`;
    const response = await fetch(url);
    const data = await response.json();

    if (!data.Search) {
      autocompleteBox.style.display = "none";
      return;
    }

    autocompleteBox.innerHTML = data.Search.slice(0, 5).map(m => `
      <div class="autocomplete-item" data-title="${m.Title}">
        ${m.Title} (${m.Year})
      </div>
    `).join("");

    autocompleteBox.style.display = "block";

    // Click autocomplete suggestion
    document.querySelectorAll(".autocomplete-item").forEach(item => {
      item.addEventListener("click", () => {
        searchInput.value = item.dataset.title;
        autocompleteBox.style.display = "none";
        startSearch();
      });
    });
  }

  searchInput.addEventListener("input", e => {
    updateAutocomplete(e.target.value);
  });

  /* -------------------------------------------
     MULTI SEARCH MODE
  ------------------------------------------- */
  function detectSearchType(query) {
    query = query.toLowerCase();

    if (query.includes("starring")) {
      return { mode: "actor", name: query.replace("starring", "").trim() };
    }

    if (query.includes("directed by")) {
      return { mode: "director", name: query.replace("directed by", "").trim() };
    }

    if (["action", "comedy", "horror", "romance", "sci-fi"].some(g => query.includes(g))) {
      return { mode: "genre", name: query };
    }

    return { mode: "title", name: query };
  }

  async function fetchMovies(query, page = 1) {
    const searchType = detectSearchType(query);
    let url = "";

    if (searchType.mode === "title") {
      url = `https://www.omdbapi.com/?apikey=${apiKey}&s=${query}&page=${page}`;
    }

    if (searchType.mode === "actor") {
      url = `https://www.omdbapi.com/?apikey=${apiKey}&s=${searchType.name}&page=${page}`;
    }

    if (searchType.mode === "director") {
      url = `https://www.omdbapi.com/?apikey=${apiKey}&s=${searchType.name}&page=${page}`;
    }

    if (searchType.mode === "genre") {
      url = `https://www.omdbapi.com/?apikey=${apiKey}&s=&page=${page}`;
      // NOTE: OMDB doesn't support genre search directly. We would filter after fetch.
    }

    return fetch(url).then(r => r.json());
  }

  /* -------------------------------------------
     SEARCH
  ------------------------------------------- */
  async function startSearch(reset = true) {
    const query = searchInput.value.trim();
    if (!query) return;

    autocompleteBox.style.display = "none";

    if (reset) {
      results.innerHTML = "";
      currentPage = 1;
    }

    currentQuery = query;

    loadMore();
  }

  /* -------------------------------------------
     INFINITE SCROLL (LOAD MORE)
  ------------------------------------------- */
  async function loadMore() {
    if (loading) return;
    loading = true;
    showSpinner();

    const cacheKey = `search_${currentQuery}_${currentPage}`;
    let data = loadCache(cacheKey);

    if (!data) {
      data = await fetchMovies(currentQuery, currentPage);
      if (data.Response !== "False") saveCache(cacheKey, data);
    }

    hideSpinner();
    loading = false;

    if (!data.Search) return;

    displayResults(data.Search);

    currentPage += 1;
  }

  window.addEventListener("scroll", () => {
    if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 200) {
      loadMore();
    }
  });

  /* -------------------------------------------
     DISPLAY MOVIES
  ------------------------------------------- */
  function sortResults(list) {
    const type = sortSelect.value;
    if (type === "none") return list;

    return [...list].sort((a, b) => {
      if (type === "title-asc") return a.Title.localeCompare(b.Title);
      if (type === "title-desc") return b.Title.localeCompare(a.Title);
      if (type === "year-asc") return a.Year.localeCompare(b.Year);
      if (type === "year-desc") return b.Year.localeCompare(a.Year);
    });
  }

  function displayResults(list) {
    const sorted = sortResults(list);

    results.innerHTML += sorted.map(movie => `
      <div class="movie" data-id="${movie.imdbID}">
        <img src="${movie.Poster !== "N/A" ? movie.Poster : placeholder}">
        <h3>${movie.Title}</h3>
      </div>
    `).join("");

    document.querySelectorAll(".movie").forEach(card => {
      card.onclick = () => showMovieDetails(card.dataset.id);
    });
  }

  /* -------------------------------------------
     MOVIE MODAL + RECENTLY VIEWED
  ------------------------------------------- */
  function saveRecentlyViewed(movie) {
    let list = JSON.parse(localStorage.getItem("recent") || "[]");

    list = list.filter(m => m.imdbID !== movie.imdbID);
    list.unshift(movie);

    list = list.slice(0, 10);
    localStorage.setItem("recent", JSON.stringify(list));

    renderRecentlyViewed();
  }

  function renderRecentlyViewed() {
    let list = JSON.parse(localStorage.getItem("recent") || "[]");

    if (list.length === 0) {
      recentlyViewed.innerHTML = "";
      return;
    }

    recentlyViewed.innerHTML = `
      <h2>Recently Viewed</h2>
      <div class="recent-row">
        ${list.map(m => `
          <div class="movie" data-id="${m.imdbID}">
            <img src="${m.Poster !== "N/A" ? m.Poster : placeholder}">
            <h3>${m.Title}</h3>
          </div>
        `).join("")}
      </div>
    `;

    // Make items clickable
    recentlyViewed.querySelectorAll(".movie").forEach(card => {
      card.onclick = () => showMovieDetails(card.dataset.id);
    });
  }

  renderRecentlyViewed();

  async function showMovieDetails(id) {
    modal.style.display = "flex";
    modalBody.innerHTML = "Loading...";

    let url = `https://www.omdbapi.com/?apikey=${apiKey}&i=${id}&plot=full`;
    let movie = await fetch(url).then(r => r.json());

    saveRecentlyViewed(movie);

    modalBody.innerHTML = `
      <h2>${movie.Title} (${movie.Year})</h2>
      <img src="${movie.Poster}">
      <p><strong>Genre:</strong> ${movie.Genre}</p>
      <p><strong>Director:</strong> ${movie.Director}</p>
      <p><strong>Actors:</strong> ${movie.Actors}</p>
      <p>${movie.Plot}</p>
      <button id="add-watch">Add to Watchlist</button>
    `;

    document.getElementById("add-watch").onclick = () => addToWatchlist(movie);
  }

  closeModal.onclick = () => modal.style.display = "none";

  /* -------------------------------------------
     WATCHLIST
  ------------------------------------------- */
  function addToWatchlist(movie) {
    let list = JSON.parse(localStorage.getItem("watchlist") || "[]");

    if (!list.some(m => m.imdbID === movie.imdbID)) {
      list.push(movie);
      localStorage.setItem("watchlist", JSON.stringify(list));
      alert("Added to watchlist!");
    } else {
      alert("Already in watchlist!");
    }
  }

  watchlistBtn.onclick = () => {
    const list = JSON.parse(localStorage.getItem("watchlist") || "[]");

    results.innerHTML = "<h2>Your Watchlist</h2>" + list.map(movie => `
      <div class="movie" data-id="${movie.imdbID}">
        <img src="${movie.Poster}">
        <h3>${movie.Title}</h3>
      </div>
    `).join("");

    document.querySelectorAll(".movie").forEach(card => {
      card.onclick = () => showMovieDetails(card.dataset.id);
    });
  };

  /* -------------------------------------------
     BUTTON HANDLERS
  ------------------------------------------- */
  searchBtn.onclick = startSearch;
  searchInput.addEventListener("keydown", e => {
    if (e.key === "Enter") startSearch();
  });

  sortSelect.onchange = () => {
    startSearch();
  };

  clearCacheBtn.onclick = () => {
    localStorage.clear();
    alert("Cache cleared!");
    location.reload();
  };

  darkModeBtn.onclick = () => {
    document.body.classList.toggle("dark");
  };
});
