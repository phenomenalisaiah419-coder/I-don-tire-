import 'package:flutter/material.dart';

class PhenovaTheme {
  static ThemeData dark() {
    final scheme=ColorScheme.fromSeed(seedColor: const Color(0xFF8B5CF6),brightness: Brightness.dark);
    return ThemeData(
      useMaterial3:true, colorScheme:scheme, scaffoldBackgroundColor:const Color(0xFF0B0B10),
      appBarTheme:const AppBarTheme(backgroundColor:Color(0xFF0B0B10),surfaceTintColor:Colors.transparent),
      cardTheme:CardThemeData(color:const Color(0xFF15151D),surfaceTintColor:Colors.transparent,margin:EdgeInsets.zero),
      inputDecorationTheme:InputDecorationTheme(
        filled:true,fillColor:const Color(0xFF15151D),border:OutlineInputBorder(borderRadius:BorderRadius.all(Radius.circular(16)),borderSide:BorderSide.none),
        enabledBorder:OutlineInputBorder(borderRadius:BorderRadius.all(Radius.circular(16)),borderSide:BorderSide.none),
      ),
      navigationBarTheme:const NavigationBarThemeData(backgroundColor:Color(0xFF101017)),
    );
  }
}
