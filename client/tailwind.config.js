/** @type {import('tailwindcss').Config} */
export default {

    content: [ "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                dark: {
                    950: '#09090b', // Màu nền tối chủ đạo
                        900: '#121214',
                        800: '#1a1a1e',
                        700: '#26262b',
                }

                ,
            }

            ,
        }

        ,
    }

    ,
    plugins: [],
}