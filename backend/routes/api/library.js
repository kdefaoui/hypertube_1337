const router = require("express").Router();
const { check, validationResult } = require("express-validator");
const cloudscraper = require("cloudscraper");
const request = require("request");
const _ = require("lodash");
const { formatResponse, retMax } = require("../../utils/LibraryFunctions");

// @route   Get api/library/:pid
// @desc    Get list of movies
// @access  Private
// return imdb_code, title, year, runtime, rating, genres, summary, language, large_cover_image, torrents
router.get(
  "/:pid",
  check("pid", "Page id is required").isNumeric(),
  async (req, res) => {
    // Check if page id is exists and valid number
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ msg: "Page id is required" });
    const pid = req.params.pid; // page id
    try {
      // get movies from yts api
      const ytsResult = await cloudscraper.get(
        `https://yts.lt/api/v2/list_movies.json?sort_by=rating&page=${pid}&limit=37`
      );

      const parsedMoviesYts = JSON.parse(ytsResult);
      // if movies not returned due to page number not exist in API
      if (!parsedMoviesYts.data.movies)
        return res.status(400).json({ msg: "Page id error" });
      // format response
      const ytsData = formatResponse(parsedMoviesYts.data.movies);

      // get movies from popcorn api
      const popResult = await cloudscraper.get(
        `https://tv-v2.api-fetch.website/movies/${pid}?sort=rating&order=-1`
      );
      if (!popResult) return res.json(ytsData);

      const parsedMoviesPop = JSON.parse(popResult);
      // if movies not returned due to page number not exist in API
      if (_.isEmpty(parsedMoviesPop)) return res.json(ytsData);

      const popData = formatResponse(parsedMoviesPop);

      // Merge the two arrays, Delete duplicate movies by imdb code, order by rating
      const result = _.concat(ytsData, popData);
      let filtred = _.uniqBy(result, "imdb_code");
      filtred = _.orderBy(filtred, ["rating"], ["desc"]);
      return res.json(filtred);
    } catch (error) {
      console.log(error);
      return res.status(500).json({ msg: "Server error" });
    }
  }
);

// @route   Get api/library/:keyword
// @desc    Search for a movie
// @access  Private
// return imdb_code, title, year, runtime, rating, genres, summary, language, large_cover_image, torrents
router.get(
  "/search/:keyword",
  check("keyword", "Keyword id is required").isString(),
  async (req, res) => {
    // Check if page id is exists and valid number
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ msg: "Keyword id is required" });
    const keyword = req.params.keyword;

    try {
      const options = {
        method: "GET",
        url: "https://movie-database-imdb-alternative.p.rapidapi.com/",
        qs: { page: "1", r: "json", s: keyword },
        headers: {
          "x-rapidapi-host": "movie-database-imdb-alternative.p.rapidapi.com",
          "x-rapidapi-key": "d711f40390msh574e342547e129ap1d4c6ajsnb930ad3ee946"
        }
      };

      request(options, async (error, response, body) => {
        if (error) return res.status(400).json({ msg: "Bad request" });
        body = JSON.parse(body);
        body.Search = _.uniqBy(body.Search, "imdbID");
        let movies = [];
        let torrentFail = false;
        if (body.Response === "True") {
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

            const ytsData = formatResponse(parsedMoviesYts.data.movies);
            movies = _.concat(ytsData, movies);
          }
          movies = _.orderBy(movies, ["rating"], ["desc"]);
          for (let index = 0; index < body.Search.length; index++) {
            //console.log(body.Search[index].imdbID);
            const popResult = await cloudscraper.get(
              `https://tv-v2.api-fetch.website/movie/${body.Search[index].imdbID}`
            );

            if (!popResult) continue;
            const parsedMoviesPop = [];
            parsedMoviesPop.push(JSON.parse(popResult));
            // if movies not returned due to page number not exist in API
            if (_.isEmpty(parsedMoviesPop) && torrentFail)
              return res.status(400).json({ msg: "Torrent not found" });
            else if (_.isEmpty(parsedMoviesPop) && !torrentFail)
              return res.json(movies);

            const popData = formatResponse(parsedMoviesPop);
            movies = _.concat(popData, movies);
          }
          movies = _.orderBy(movies, ["rating"], ["desc"]);
          // return unique movies by seeds number
          movies = _.uniqWith(movies, retMax);
          return res.json(movies);
        }
        return res.status(400).json({ msg: "Result not found" });
      });
    } catch (error) {
      return res.status(500).json({ msg: "Server error" });
    }
  }
);

module.exports = router;
