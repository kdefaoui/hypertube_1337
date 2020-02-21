import React, { useState, useEffect } from "react";
import "./App.css";
import { BrowserRouter as Router, Route, Switch } from "react-router-dom";
import { MuiThemeProvider, createMuiTheme } from "@material-ui/core/styles";
import { CssBaseline } from "@material-ui/core";

import Login from "./Components/user/login";
import Forget from "./Components/user/Forget";
import Register from "./Components/user/register";
import Reset from "./Components/user/Reset";
import Verify from "./Components/user/Verify";
import Streaming from "./Components/streaming/streaming";
import Library from "./Components/pages/Library";
import NavBar from "./Components/inc/NavBar";
import Footer from "./Components/inc/Footer";
import { Profile } from "./Components/profile/Profile";
import { EditProfile } from "./Components/editProfile/EditProfile";
// Redux
import { useSelector } from "react-redux";
import { useDispatch } from "react-redux";

import { t, setLocale, getLocale } from "../src/i18n";
import i18n from "i18n-js";

import setTokenToAxiosHeader from './utils/setTokenToAxiosHeader';
import { loadUser } from "./actions/userAction";

// Set axios headers
if (localStorage.token) {
  setTokenToAxiosHeader(localStorage.token);
}

function App() {
  const dispatch = useDispatch();
  const { user } = useSelector(state => state);

  const [theme, setTheme] = useState({
    palette: {
      type: localStorage.getItem("darkMode")
        ? localStorage.getItem("darkMode")
        : "light"
    }
  });

  const [Lang, setLang] = useState({
    langage: {
      type: localStorage.getItem("LANGUAGE")
        ? localStorage.getItem("LANGUAGE")
        : "fr"
    }
  });

  const toggleDarkTheme = () => {
    let newPaletteType = theme.palette.type === "light" ? "dark" : "light";
    localStorage.setItem("darkMode", newPaletteType);
    setTheme({
      palette: {
        type: newPaletteType
      }
    });
  };

  const toggleLanguage = async () => {
    let newLangType = Lang.langage.type === "en" ? "fr" : "en";
    await setLocale(Lang.langage.type);
    await setLang({
      langage: {
        type: newLangType
      }
    });
  };

  console.log("ss", localStorage.getItem("sss"));
  let deflang = localStorage.getItem("LANGUAGE")
    ? localStorage.getItem("LANGUAGE")
    : getLocale(i18n.locale);

  const muiTheme = createMuiTheme(theme, deflang);

  useEffect(() => {
    dispatch(loadUser());
  }, [])

  useEffect(() => {
    console.log("loaduser", user);
  }, [user])

  return (
    <MuiThemeProvider theme={muiTheme}>
      <CssBaseline />
      <div
        style={{
          display: "flex",
          minHeight: "100vh",
          flexDirection: "column"
        }}
      >
        <Router>
          <NavBar setDarkMode={toggleDarkTheme} Langage={toggleLanguage} />
          <div style={{ flex: 1 }}>
            <Switch>
              <Route exact path="/login" component={Login} />
              <Route exact path="/register" component={Register} />
              <Route exact path="/forgetpassword" component={Forget} />
              <Route exact path="/reset_password/:token" component={Reset} />
              <Route exact path="/verify_email/:token" component={Verify} />
              <Route exact path="/profile" component={Profile} />
              <Route exact path="/editprofile" component={EditProfile} />
              <Route exact path="/library" component={Library} />
              <Route exact path="/streaming/:imdb" component={Streaming} />
            </Switch>
          </div>
          <Footer style={{ flex: 1 }} />
        </Router>
      </div>
    </MuiThemeProvider>
  );
}

export default App;
