const router = require("express").Router();
const { check, validationResult } = require("express-validator");
const cloudscraper = require("cloudscraper");
const config = require("config");
const rp = require("request-promise");
const _ = require("lodash");
const cache = require("apicache").middleware;

const middleware = require("../../middleware/midlleware");
const {
  retMax,
  getMovieMoreInfo,
  getMovies,
  formatYtsResponse,
  formatPopResponse
} = require("../../utils/LibraryFunctions");

// @route   Get api/library/movies/page/:pid
// @desc    Get list of movies
// @access  Private
// return imdb_code, title, year, runtime, rating, genres, summary, language, large_cover_image, torrents
router.get(
  "/movies/page/",
  [middleware.moviesByPage(), cache("5 minutes")],
  async (req, res) => {
    //Check if page id is exists and valid number
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ msg: "Parameter Error" });

    try {
      // get movies from yts api
      let ytsResult = await getMovies(req.query, "yts");
      ytsResult = await getMovieMoreInfo(ytsResult);

      // if movies not returned due to page number not exist in API
      if (!ytsResult) return res.status(404).json({ msg: "Result not found" });

      // get movies from popcorn api
      let popResult = await getMovies(req.query, "pop");
      if (!popResult || _.isEmpty(popResult)) return res.json(ytsResult);

      // Merge the two arrays, Delete duplicate movies by imdb code, order by
      const result = _.concat(ytsResult, popResult);
      let filtred = _.uniqBy(result, "imdb_code");
      filtred = _.orderBy(filtred, req.query.sort_by, ["desc"]);
      return res.json(filtred);
    } catch (error) {
      console.log(error);
      return res.status(500).json({ msg: "Server error" });
    }
  }
);

// @route   Get api/library/movies/keyword/:keyword
// @desc    Search for a movie by keyword
// @access  Private
// return imdb_code, title, year, runtime, rating, genres, summary, language, large_cover_image, torrents
router.get(
  "/movies/keyword/:keyword",
  [check("keyword", "Keyword id is required").isString(), cache("5 minutes")],
  async (req, res) => {
    // Check if page id is exists and valid number
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ msg: "Keyword id is required" });
    const keyword = req.params.keyword;
    const rapidApiKey = config.get("rapidApiKey");
    let torrentFail = false;
    let movies = [];

    try {
      const options = {
        method: "GET",
        url: "https://movie-database-imdb-alternative.p.rapidapi.com/",
        qs: { page: "1", r: "json", s: keyword },
        headers: {
          "x-rapidapi-host": "movie-database-imdb-alternative.p.rapidapi.com",
          "x-rapidapi-key": rapidApiKey
        }
      };
      let body = await rp(options);
      body = JSON.parse(body);
      body.Search = _.uniqBy(body.Search, "imdbID");
      if (body.Response !== "True")
        return res.status(404).json({ msg: "Result not found" });

      for (let index = 0; index < body.Search.length; index++) {
        const ytsResult = await cloudscraper.get(
          `https://yts.lt/api/v2/list_movies.json?query_term=${body.Search[index].imdbID}`
        );

        const parsedMoviesYts = JSON.parse(ytsResult);
        // if movies not returned due to page number not exist in API
        if (!parsedMoviesYts.data.movies) {
          torrentFail = true;
          break;
        }

        const ytsData = formatYtsResponse(parsedMoviesYts.data.movies);
        movies = _.concat(ytsData, movies);
        movies = await getMovieMoreInfo(movies);
      }
      movies = _.orderBy(movies, ["title"], ["asc"]);
      for (let index = 0; index < body.Search.length; index++) {
        const popResult = await rp.get(
          `https://tv-v2.api-fetch.website/movie/${body.Search[index].imdbID}`
        );

        if (!popResult) continue;
        const parsedMoviesPop = [];
        parsedMoviesPop.push(JSON.parse(popResult));
        // if movies not returned due to page number not exist in API
        if (_.isEmpty(parsedMoviesPop) && torrentFail)
          return res.status(404).json({ msg: "Torrent not found" });
        else if (_.isEmpty(parsedMoviesPop) && !torrentFail)
          return res.json(movies);

        const popData = formatPopResponse(parsedMoviesPop);
        movies = _.concat(popData, movies);
      }
      movies = _.orderBy(movies, ["title"], ["asc"]);
      // return unique movies by seeds number
      movies = _.uniqWith(movies, retMax);
      return res.json(movies);
    } catch (error) {
      console.log(error);
      return res.status(500).json({ msg: "Server error" });
    }
  }
);

// @route   Get api/library/movies/imdb_code/:imdb_code
// @desc    Search for a movie by imdb_code
// @access  Private
// return imdb_code, title, year, runtime, rating, genres, summary, language, large_cover_image, torrents
router.get(
  "/movies/imdb_code/:imdb_code",
  check("imdb_code", "ID is required").exists(),
  async (req, res) => {
    // Check if page id is exists and valid number
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ msg: "ID is required" });

    const imdb_code = req.params.imdb_code;
    try {
      // get movie from yts api
      const ytsResult = await cloudscraper.get(
        `https://yts.lt/api/v2/list_movies.json?query_term=${imdb_code}`
      );

      const parsedMoviesYts = JSON.parse(ytsResult);

      if (!parsedMoviesYts.data.movies)
        return res.status(404).json({ msg: "Movie not found" });
      // format response
      const ytsData = formatYtsResponse(parsedMoviesYts.data.movies);

      // get movie from popcorn api
      const popResult = await rp.get(
        `https://tv-v2.api-fetch.website/movie/${imdb_code}`
      );
      if (!popResult) return res.json(ytsData);

      const parsedMoviesPop = [];
      parsedMoviesPop.push(JSON.parse(popResult));

      if (_.isEmpty(parsedMoviesPop)) return res.json(ytsData);
      // format response
      const popData = formatPopResponse(parsedMoviesPop);
      // return best result depending on seeds number
      const result =
        ytsData[0].torrents[0].seeds >= popData[0].torrents[0].seeds
          ? await getMovieMoreInfo(ytsData)
          : await getMovieMoreInfo(popData);

      return res.json(result);
    } catch (error) {
      return res.status(500).json({ msg: "Server error" });
    }
  }
);

// @route   Get api/library/movies/genre/:genre
// @desc    Search for a movie by imdb_code
// @access  Private
// return imdb_code, title, year, runtime, rating, genres, summary, language, large_cover_image, torrents
router.get(
  "/movies/genre/:genre",
  middleware.moviesByGenre(),
  async (req, res) => {
    // Check if page id is exists and valid number
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ msg: "Not valid genre" });
    const genre = req.params.genre;

    try {
      // get movies from popcorn api
      let popResult = await rp.get(
        `https://tv-v2.api-fetch.website/movies/1?sort=trending&order=-1&genre=${genre}`
      );
      popResult = popResult ? formatPopResponse(JSON.parse(popResult)) : false;
      return res.json(popResult);
    } catch (error) {
      return res.status(500).json({ msg: "Server error" });
    }
  }
);

module.exports = router;