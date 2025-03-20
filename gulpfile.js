const gulp = require('gulp');
const concat = require('gulp-concat');
const cleanCSS = require('gulp-clean-css');
const postcss = require('gulp-postcss');
const autoprefixer = require('autoprefixer');
const browserSync = require('browser-sync').create();
const fs = require('fs');
const path = require('path');

// Paths
const paths = {
  css: {
    src: {
      base: 'css/base/*.css',
      layout: 'css/layout/*.css',
      components: 'css/components/*.css',
      utils: 'css/utils/*.css',
      pages: 'css/pages/*.css'
    },
    dest: 'dist/css'
  },
  html: '*.html'
};

// Buat folder jika tidak ada
function ensureDirectoryExistence(filePath) {
  const dirname = path.dirname(filePath);
  if (fs.existsSync(dirname)) {
    return true;
  }
  ensureDirectoryExistence(dirname);
  fs.mkdirSync(dirname);
}

// Pastikan direktori ada sebelum menjalankan task
function createDirectories(done) {
  ensureDirectoryExistence(path.join(paths.css.dest, 'dummy.txt'));
  ensureDirectoryExistence(path.join(paths.css.dest, 'pages', 'dummy.txt'));
  done();
}

// Bundle CSS utama (tanpa halaman spesifik)
function bundleMainCSS() {
  return gulp.src([
    // Base
    'css/base/reset.css',
    'css/base/typography.css',
    'css/base/variables.css',
    
    // Layout
    'css/layout/grid.css',
    'css/layout/header.css',
    'css/layout/sidebar.css',
    'css/layout/mainbar.css',
    
    // Components
    'css/components/buttons.css',
    'css/components/cards.css',
    'css/components/forms.css',
    'css/components/tables.css',
    'css/components/alerts.css',
    
    // Utils
    'css/utils/helpers.css',
    'css/utils/responsive.css'
  ])
  .pipe(concat('main.min.css'))
  .pipe(postcss([autoprefixer()]))
  .pipe(cleanCSS())
  .pipe(gulp.dest(paths.css.dest));
}

// Bundle CSS untuk setiap halaman
function bundlePageCSS() {
  // Daftar halaman
  const pages = ['absensi', 'pengajuan', 'supervisor', 'pengguna', 'dashboard'];
  
  // Buat bundle untuk setiap halaman
  const tasks = pages.map(page => {
    return gulp.src([
      `${paths.css.dest}/main.min.css`,
      `css/pages/${page}.css`
    ])
    .pipe(concat(`${page}.min.css`))
    .pipe(cleanCSS())
    .pipe(gulp.dest(`${paths.css.dest}/pages`));
  });
  
  return Promise.all(tasks);
}

// Watch files
function watchFiles() {
  browserSync.init({
    server: {
      baseDir: './'
    }
  });
  
  gulp.watch(paths.css.src.base, bundleMainCSS);
  gulp.watch(paths.css.src.layout, bundleMainCSS);
  gulp.watch(paths.css.src.components, bundleMainCSS);
  gulp.watch(paths.css.src.utils, bundleMainCSS);
  gulp.watch(paths.css.src.pages, bundlePageCSS);
  gulp.watch(paths.html).on('change', browserSync.reload);
}

// Define tasks
const build = gulp.series(createDirectories, bundleMainCSS, bundlePageCSS);
const watch = gulp.series(build, watchFiles);

// Export tasks
exports.bundleMainCSS = bundleMainCSS;
exports.bundlePageCSS = bundlePageCSS;
exports.watch = watch;
exports.build = build;
exports.default = build;
